// ==================== CREATOR DETAIL ====================
        // ==================== GOALS ====================
        async function loadGoalsData() {
            const { data: goals } = await supabaseClient.from('goals').select('*').order('created_at', { ascending: false });
            
            if (!goals || goals.length === 0) {
                document.getElementById('goalsTarget').textContent = '$0';
                document.getElementById('goalsCurrent').textContent = '$0';
                document.getElementById('goalsProgress').textContent = '0%';
                document.getElementById('goalsDaysLeft').textContent = '−';
                document.getElementById('goalsBody').innerHTML = '<div class="empty-state"><div class="icon">🎯</div><h3>No goals set</h3><p>Click "Set Goal" to create your first target</p></div>';
                return;
            }

            // Calculate progress for each goal
            const goalsWithProgress = await Promise.all(goals.map(async (g) => {
                // Fetch actual GMV for goal period
                let query = supabaseClient.from('creator_performance')
                    .select('gmv')
                    .gte('report_date', g.period_start)
                    .lte('report_date', g.period_end)
                    .eq('period_type', 'daily');
                
                if (g.goal_type === 'brand' && g.target_entity) {
                    query = query.eq('brand', g.target_entity);
                }
                
                const { data: perfData } = await query;
                const actualGmv = (perfData || []).reduce((s, p) => s + (p.gmv || 0), 0);
                const progress = g.target_gmv > 0 ? Math.min(100, (actualGmv / g.target_gmv * 100)) : 0;
                
                // Calculate days left
                const today = new Date();
                const endDate = new Date(g.period_end + 'T23:59:59');
                const daysLeft = Math.max(0, Math.ceil((endDate - today) / (1000 * 60 * 60 * 24)));
                
                return { ...g, actualGmv, progress, daysLeft };
            }));

            // Update summary stats (use first/main goal)
            const mainGoal = goalsWithProgress[0];
            document.getElementById('goalsTarget').textContent = fmtMoney(mainGoal.target_gmv);
            document.getElementById('goalsCurrent').textContent = fmtMoney(mainGoal.actualGmv);
            document.getElementById('goalsProgress').textContent = mainGoal.progress.toFixed(0) + '%';
            document.getElementById('goalsDaysLeft').textContent = mainGoal.daysLeft;

            // Show all goals with progress
            document.getElementById('goalsBody').innerHTML = goalsWithProgress.map(g => {
                const progressClass = g.progress >= 100 ? 'green' : g.progress >= 50 ? 'yellow' : 'red';
                const statusText = g.progress >= 100 ? '✅ Goal achieved!' : 
                    g.daysLeft === 0 ? '❌ Goal period ended' : 
                    `${g.daysLeft} days remaining`;
                const statusColor = g.progress >= 100 ? 'var(--success)' : g.daysLeft === 0 ? 'var(--danger)' : 'var(--text-muted)';
                
                return `<div style="padding: 16px; border: 1px solid var(--border); border-radius: 10px; margin-bottom: 12px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <strong>${g.goal_type === 'brand' ? BRAND_DISPLAY[g.target_entity] || g.target_entity : 'All Brands'} - ${g.period_type}</strong>
                        <span style="color: var(--accent); font-family: 'Space Mono', monospace;">${fmtMoney(g.target_gmv)}</span>
                    </div>
                    <div class="progress-bar"><div class="progress-fill ${progressClass}" style="width: ${g.progress}%"></div></div>
                    <div style="display: flex; justify-content: space-between; margin-top: 8px; font-size: 0.8rem;">
                        <span style="color: var(--text-primary); font-family: 'Space Mono', monospace;">${fmtMoney(g.actualGmv)} <span style="color: var(--text-muted);">/ ${fmtMoney(g.target_gmv)}</span></span>
                        <span style="color: ${statusColor};">${statusText}</span>
                    </div>
                    <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 6px;">
                        ${formatDate(g.period_start)} → ${formatDate(g.period_end)}
                    </div>
                </div>`;
            }).join('');
        }

        // ==================== ALERTS ====================
        async function loadAlertsData() {
            const { data: alerts } = await supabaseClient.from('alerts').select('*').order('created_at', { ascending: false }).limit(50);
            
            const alertsBody = document.getElementById('alertsBody');
            const alertCount = document.getElementById('alertCount');
            
            if (!alerts || alerts.length === 0) {
                if (alertsBody) alertsBody.innerHTML = '<div class="empty-state"><div class="icon">🔔</div><h3>No alerts</h3><p>Alerts will appear when there are significant changes</p></div>';
                if (alertCount) alertCount.style.display = 'none';
                updateAlertsBell(0);
                return;
            }

            const unread = alerts.filter(a => !a.is_read).length;
            if (alertCount) {
                alertCount.textContent = unread;
                alertCount.style.display = unread > 0 ? 'inline' : 'none';
            }
            updateAlertsBell(unread);

            if (alertsBody) {
                alertsBody.innerHTML = alerts.map(a => {
                    const iconClass = a.severity === 'critical' ? 'danger' : a.severity === 'warning' ? 'warning' : a.alert_type.includes('success') ? 'success' : 'info';
                    const icon = a.severity === 'critical' ? '🚨' : a.severity === 'warning' ? '⚠️' : '📢';
                    return `<div class="alert-item" style="${a.is_read ? 'opacity: 0.7' : ''}">
                        <div class="alert-icon ${iconClass}">${icon}</div>
                        <div class="alert-content">
                            <div class="alert-title">${a.message}</div>
                            <div class="alert-message">${a.creator_name ? `Creator: ${a.creator_name}` : ''} ${a.brand ? `• ${BRAND_DISPLAY[a.brand]}` : ''}</div>
                            <div class="alert-time">${new Date(a.created_at).toLocaleDateString()}</div>
                        </div>
                    </div>`;
                }).join('');
            }
        }

        // ==================== AUTO ALERT GENERATION ====================
        async function generateAutoAlerts() {
            // Get yesterday and day before for comparison
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const dayBefore = new Date();
            dayBefore.setDate(dayBefore.getDate() - 2);
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            
            const yesterdayStr = localDateStr(yesterday);
            const dayBeforeStr = localDateStr(dayBefore);
            const weekAgoStr = localDateStr(weekAgo);
            
            // Get recent performance data
            const { data: recentData } = await supabaseClient.from('creator_performance')
                .select('*')
                .gte('report_date', weekAgoStr)
                .eq('period_type', 'daily');
            
            if (!recentData || recentData.length === 0) return;
            
            // Group by creator (only managed creators)
            const creatorStats = new Map();
            recentData.forEach(row => {
                // Only include managed creators
                if (!isManagedForBrand(row.creator_name, row.brand)) return;
                
                const key = `${row.creator_name}|||${row.brand}`;
                if (!creatorStats.has(key)) {
                    creatorStats.set(key, { 
                        name: row.creator_name, 
                        brand: row.brand,
                        days: []
                    });
                }
                creatorStats.get(key).days.push({
                    date: row.report_date,
                    gmv: pFloat(row.gmv)
                });
            });
            
            const newAlerts = [];
            
            // Detect alerts
            creatorStats.forEach((stats, key) => {
                const days = stats.days.sort((a, b) => a.date.localeCompare(b.date));
                if (days.length < 2) return;
                
                const latestDay = days[days.length - 1];
                const previousDay = days[days.length - 2];
                const totalGmv = days.reduce((s, d) => s + d.gmv, 0);
                
                // Alert 1: GMV dropped more than 50% day over day (for significant creators)
                if (previousDay.gmv > 100 && latestDay.gmv < previousDay.gmv * 0.5) {
                    const dropPct = ((previousDay.gmv - latestDay.gmv) / previousDay.gmv * 100).toFixed(0);
                    newAlerts.push({
                        alert_type: 'gmv_drop',
                        severity: 'warning',
                        brand: stats.brand,
                        creator_name: stats.name,
                        message: `${stats.name} GMV dropped ${dropPct}%`,
                        metric_value: latestDay.gmv,
                        comparison_value: previousDay.gmv,
                        change_percent: -parseFloat(dropPct),
                        report_date: latestDay.date
                    });
                }
                
                // Alert 2: New top performer (>$500 in a day for first time)
                if (latestDay.gmv >= 500 && days.length <= 3) {
                    newAlerts.push({
                        alert_type: 'new_top_performer',
                        severity: 'info',
                        brand: stats.brand,
                        creator_name: stats.name,
                        message: `🌟 New star! ${stats.name} hit ${fmtMoney(latestDay.gmv)} GMV`,
                        metric_value: latestDay.gmv,
                        report_date: latestDay.date
                    });
                }
                
                // Alert 3: Milestone achievement ($1K, $5K, $10K in a single day)
                const milestones = [10000, 5000, 1000];
                for (const milestone of milestones) {
                    if (latestDay.gmv >= milestone && previousDay.gmv < milestone) {
                        newAlerts.push({
                            alert_type: 'milestone',
                            severity: 'info',
                            brand: stats.brand,
                            creator_name: stats.name,
                            message: `🎉 ${stats.name} crossed ${fmtMoney(milestone)} daily GMV!`,
                            metric_value: latestDay.gmv,
                            report_date: latestDay.date
                        });
                        break; // Only one milestone alert
                    }
                }
            });
            
            // Insert new alerts (avoid duplicates)
            if (newAlerts.length > 0) {
                for (const alert of newAlerts) {
                    // Check if similar alert exists in last 24 hours
                    const { data: existing } = await supabaseClient.from('alerts')
                        .select('id')
                        .eq('alert_type', alert.alert_type)
                        .eq('creator_name', alert.creator_name)
                        .gte('created_at', new Date(Date.now() - 86400000).toISOString())
                        .limit(1);
                    
                    if (!existing || existing.length === 0) {
                        await supabaseClient.from('alerts').insert([alert]);
                    }
                }
                
                // Refresh alerts display
                if (currentView === 'alerts') {
                    loadAlertsData();
                }
                
                // Update alert badge count
                const { count } = await supabaseClient.from('alerts').select('*', { count: 'exact', head: true }).eq('is_read', false);
                const badge = document.getElementById('alertCount');
                if (badge) {
                    badge.textContent = count || 0;
                    badge.style.display = count > 0 ? 'inline' : 'none';
                }
            }
        }

        // ==================== CREATOR DETAIL ====================
        let creatorDetailChartInstance = null;
        let currentCreatorDetail = { name: null, brand: null };
        
        async function openCreatorDetail(creatorName, brand) {
            // Store current creator for action buttons
            currentCreatorDetail = { name: creatorName, brand: brand };
            
            // Show loading state
            document.getElementById('creatorDetailTitle').textContent = creatorName;
            document.getElementById('creatorDetailBody').innerHTML = '<div class="loading"><div class="spinner"></div> Loading creator data...</div>';
            
            // Add action buttons
            document.getElementById('creatorDetailActions').innerHTML = `
                <button class="btn btn-secondary" style="padding: 6px 12px; font-size: 0.8rem;" onclick="showChangeBrandModal()">
                    🔄 Fix Brand
                </button>
                <button class="btn" style="padding: 6px 12px; font-size: 0.8rem; background: var(--danger); color: white;" onclick="confirmRemoveCreator()">
                    🗑️ Remove
                </button>
            `;
            
            document.getElementById('creatorDetailModal').classList.add('show');
            
            // Get date range from Creators section, fallback to Overview, then default
            let startDate = document.getElementById('creatorsDateFilterStart')?.value || 
                           document.getElementById('dateFilterStart')?.value;
            let endDate = document.getElementById('creatorsDateFilterEnd')?.value || 
                         document.getElementById('dateFilterEnd')?.value;
            
            // Default to last 30 days if no dates set
            if (!startDate || !endDate) {
                const today = new Date();
                const thirtyDaysAgo = new Date(today);
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                startDate = localDateStr(thirtyDaysAgo);
                endDate = localDateStr(today);
            }
            
            // Calculate prior period for comparison
            const start = new Date(startDate + 'T00:00:00');
            const end = new Date(endDate + 'T00:00:00');
            const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
            const priorEnd = new Date(start);
            priorEnd.setDate(priorEnd.getDate() - 1);
            const priorStart = new Date(priorEnd);
            priorStart.setDate(priorStart.getDate() - daysDiff + 1);

            // Fetch current period data with pagination
            let perfData = [];
            let page = 0;
            const pageSize = QUERY_PAGE_SIZE;
            let hasMore = true;
            
            while (hasMore) {
                const { data, error } = await supabaseClient.from('creator_performance')
                    .select('*')
                    .eq('creator_name', creatorName)
                    .eq('brand', brand)
                    .eq('period_type', 'daily')
                    .gte('report_date', startDate)
                    .lte('report_date', endDate)
                    .order('report_date', { ascending: true })
                    .range(page * pageSize, (page + 1) * pageSize - 1);
                
                if (error || !data || data.length === 0) {
                    hasMore = false;
                } else {
                    perfData = perfData.concat(data);
                    hasMore = data.length === pageSize;
                    page++;
                }
                if (page >= MAX_PAGES) break;
            }

            // Fetch prior period data
            let priorData = [];
            page = 0;
            hasMore = true;
            
            while (hasMore) {
                const { data, error } = await supabaseClient.from('creator_performance')
                    .select('*')
                    .eq('creator_name', creatorName)
                    .eq('brand', brand)
                    .eq('period_type', 'daily')
                    .gte('report_date', localDateStr(priorStart))
                    .lte('report_date', localDateStr(priorEnd))
                    .range(page * pageSize, (page + 1) * pageSize - 1);
                
                if (error || !data || data.length === 0) {
                    hasMore = false;
                } else {
                    priorData = priorData.concat(data);
                    hasMore = data.length === pageSize;
                    page++;
                }
                if (page >= MAX_PAGES) break;
            }

            // Aggregate current period
            const current = {
                gmv: 0, refunds: 0, orders: 0, items_sold: 0,
                videos: 0, live_streams: 0, est_commission: 0
            };
            perfData.forEach(p => {
                current.gmv += pFloat(p.gmv);
                current.refunds += pFloat(p.refunds);
                current.orders += pInt(p.orders);
                current.items_sold += pInt(p.items_sold);
                current.videos += pInt(p.videos);
                current.live_streams += pInt(p.live_streams);
                current.est_commission += pFloat(p.est_commission);
            });
            current.aov = current.orders > 0 ? current.gmv / current.orders : 0;

            // Aggregate prior period
            const prior = { gmv: 0, orders: 0, videos: 0 };
            priorData.forEach(p => {
                prior.gmv += pFloat(p.gmv);
                prior.orders += pInt(p.orders);
                prior.videos += pInt(p.videos);
            });

            // Calculate changes
            const gmvChange = prior.gmv > 0 ? ((current.gmv - prior.gmv) / prior.gmv * 100) : (current.gmv > 0 ? 100 : 0);
            const ordersChange = prior.orders > 0 ? ((current.orders - prior.orders) / prior.orders * 100) : (current.orders > 0 ? 100 : 0);
            const isNew = prior.gmv === 0 && current.gmv > 0;

            // Get videos for this creator and aggregate by video_id
            const { data: rawVideos } = await supabaseClient.from('video_performance')
                .select('*')
                .ilike('creator_name', creatorName)
                .eq('brand', brand)
                .gte('report_date', startDate)
                .lte('report_date', endDate);
            
            // Brand keyword patterns for mismatch detection
            const brandKeywords = {
                'physicians_choice': ['physicians choice', 'physician\'s choice', 'pc probiotic', 'digestive enzyme'],
                'catakor': ['cata-kor', 'catakor', 'cata kor'],
                'yerba_magic': ['yerba magic', 'yerba', 'mate'],
                'jiyu': ['jiyu', 'ji-yu', 'ji yu'],
                'peach_slices': ['peach slices', 'peach slice', 'acne']
            };
            
            function detectBrandMismatch(videoTitle, productName, taggedBrand) {
                const searchText = ((videoTitle || '') + ' ' + (productName || '')).toLowerCase();
                for (const [brandKey, keywords] of Object.entries(brandKeywords)) {
                    if (brandKey !== taggedBrand.toLowerCase()) {
                        for (const kw of keywords) {
                            if (searchText.includes(kw)) {
                                return brandKey; // Return the brand it likely belongs to
                            }
                        }
                    }
                }
                return null;
            }

            // Aggregate videos by video_id
            const videoMap = new Map();
            (rawVideos || []).forEach(row => {
                const key = row.video_id;
                if (!videoMap.has(key)) {
                    // Build proper TikTok URL from video_id and creator_name
                    const tiktokUrl = row.video_id ? `https://www.tiktok.com/@${creatorName}/video/${row.video_id}` : null;
                    const likelyBrand = detectBrandMismatch(row.video_title, row.product_name, brand);
                    videoMap.set(key, {
                        video_id: row.video_id,
                        video_title: row.video_title,
                        video_link: tiktokUrl,
                        taggedBrand: row.brand,
                        likelyBrand: likelyBrand, // If not null, this video may be mistagged
                        gmv: 0,
                        orders: 0,
                        views: 0
                    });
                }
                const v = videoMap.get(key);
                v.gmv += pFloat(row.gmv);
                v.orders += pInt(row.orders);
                v.views += pInt(row.views);
            });
            const videos = [...videoMap.values()].sort((a, b) => b.gmv - a.gmv).slice(0, 5);

            // Get notes for this creator
            const { data: notes } = await supabaseClient.from('creator_notes')
                .select('*')
                .eq('creator_name', creatorName)
                .order('created_at', { ascending: false })
                .limit(10);

            const managed = isManagedForBrand(creatorName, brand);
            const info = getManagedInfo(creatorName);
            const tier = getTier(current.gmv);
            
            // Format date range for display
            const dateRangeDisplay = `${new Date(startDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date(endDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

            document.getElementById('creatorDetailBody').innerHTML = `
                <!-- Header Section -->
                <div class="detail-header">
                    <div class="detail-avatar" style="font-size: 2rem; width: 70px; height: 70px;">${creatorName.charAt(0).toUpperCase()}</div>
                    <div class="detail-info" style="flex: 1;">
                        <div class="detail-name" style="font-size: 1.5rem; margin-bottom: 4px;">${creatorName}</div>
                        ${info?.real_name ? `<div style="color: var(--text-secondary); margin-bottom: 8px;">${info.real_name}${info.discord ? ` • Discord: ${info.discord}` : ''}</div>` : ''}
                        <div class="detail-meta" style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
                            <span class="badge-brand">${BRAND_DISPLAY[brand] || brand}</span>
                            <span class="badge-tier ${tier.class}">${tier.name}</span>
                            <span class="badge ${managed ? 'badge-managed' : 'badge-unmanaged'}">${managed ? '✓ Managed' : 'Unmanaged'}</span>
                            ${info?.role ? `<span class="badge" style="background: var(--bg-secondary);">${info.role}</span>` : ''}
                            ${info?.discord_channel_id ? `
                                <button onclick="openDiscordChat('${brand}', '${info.discord_channel_id}')" 
                                    style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; 
                                    background: #5865F2; color: white; border: none; border-radius: 6px; 
                                    font-size: 0.8rem; font-weight: 600; cursor: pointer; margin-left: 8px;"
                                    onmouseover="this.style.background='#4752C4'" 
                                    onmouseout="this.style.background='#5865F2'">
                                    💬 Open Discord Chat
                                </button>
                            ` : (managed ? `
                                <span style="color: var(--text-muted); font-size: 0.75rem; margin-left: 8px;">
                                    (No Discord channel linked)
                                </span>
                            ` : '')}
                        </div>
                    </div>
                    <div style="text-align: right; color: var(--text-muted); font-size: 0.85rem;">
                        <div>📅 ${dateRangeDisplay}</div>
                        <div style="margin-top: 4px;">${daysDiff} days</div>
                    </div>
                </div>

                <!-- Key Stats -->
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px;">
                    <div style="background: linear-gradient(135deg, rgba(245, 197, 24, 0.15) 0%, var(--bg-secondary) 100%); padding: 16px; border-radius: 12px; text-align: center;">
                        <div style="font-size: 1.8rem; font-weight: 700; color: var(--accent); font-family: 'Space Mono', monospace;">${fmtMoney(current.gmv)}</div>
                        <div style="font-size: 0.8rem; color: var(--text-muted);">Total GMV</div>
                        <div style="font-size: 0.85rem; margin-top: 4px;" class="${isNew ? '' : gmvChange >= 0 ? 'trend-up' : 'trend-down'}">
                            ${isNew ? '🆕 New Creator' : `${gmvChange >= 0 ? '↑' : '↓'} ${Math.abs(gmvChange).toFixed(1)}% vs prior`}
                        </div>
                    </div>
                    <div style="background: var(--bg-secondary); padding: 16px; border-radius: 12px; text-align: center;">
                        <div style="font-size: 1.8rem; font-weight: 700; font-family: 'Space Mono', monospace;">${fmt(current.orders)}</div>
                        <div style="font-size: 0.8rem; color: var(--text-muted);">Orders</div>
                        <div style="font-size: 0.85rem; margin-top: 4px; color: var(--text-muted);">Prior: ${fmt(prior.orders)}</div>
                    </div>
                    <div style="background: var(--bg-secondary); padding: 16px; border-radius: 12px; text-align: center;">
                        <div style="font-size: 1.8rem; font-weight: 700; font-family: 'Space Mono', monospace;">${current.videos}</div>
                        <div style="font-size: 0.8rem; color: var(--text-muted);">Videos</div>
                        <div style="font-size: 0.85rem; margin-top: 4px; color: var(--text-muted);">Prior: ${prior.videos}</div>
                    </div>
                    <div style="background: var(--bg-secondary); padding: 16px; border-radius: 12px; text-align: center;">
                        <div style="font-size: 1.8rem; font-weight: 700; font-family: 'Space Mono', monospace;">${fmtMoney(current.est_commission)}</div>
                        <div style="font-size: 0.8rem; color: var(--text-muted);">Est. Commission</div>
                        ${info?.retainer ? `<div style="font-size: 0.85rem; margin-top: 4px; color: var(--text-muted);">+ $${info.retainer}/mo retainer</div>` : ''}
                    </div>
                </div>

                <!-- Two Column Layout -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px;">
                    <!-- GMV Trend Chart -->
                    <div style="background: var(--bg-secondary); padding: 16px; border-radius: 12px;">
                        <div style="font-weight: 600; margin-bottom: 12px;">📈 GMV Trend</div>
                        <div style="height: 180px;">
                            <canvas id="creatorDetailChart"></canvas>
                        </div>
                    </div>

                    <!-- Additional Metrics -->
                    <div style="background: var(--bg-secondary); padding: 16px; border-radius: 12px;">
                        <div style="font-weight: 600; margin-bottom: 12px;">📊 Performance Metrics</div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                            <div style="background: var(--bg-card); padding: 12px; border-radius: 8px;">
                                <div style="font-size: 1.25rem; font-weight: 600;">${fmtMoney(current.aov)}</div>
                                <div style="font-size: 0.75rem; color: var(--text-muted);">Avg Order Value</div>
                            </div>
                            <div style="background: var(--bg-card); padding: 12px; border-radius: 8px;">
                                <div style="font-size: 1.25rem; font-weight: 600;">${fmtMoney(current.videos > 0 ? current.gmv / current.videos : 0)}</div>
                                <div style="font-size: 0.75rem; color: var(--text-muted);">GMV per Video</div>
                            </div>
                            <div style="background: var(--bg-card); padding: 12px; border-radius: 8px;">
                                <div style="font-size: 1.25rem; font-weight: 600;">${fmt(current.items_sold)}</div>
                                <div style="font-size: 0.75rem; color: var(--text-muted);">Items Sold</div>
                            </div>
                            <div style="background: var(--bg-card); padding: 12px; border-radius: 8px;">
                                <div style="font-size: 1.25rem; font-weight: 600;">${current.live_streams}</div>
                                <div style="font-size: 0.75rem; color: var(--text-muted);">LIVE Streams</div>
                            </div>
                            <div style="background: var(--bg-card); padding: 12px; border-radius: 8px;">
                                <div style="font-size: 1.25rem; font-weight: 600;">${fmtMoney(current.refunds)}</div>
                                <div style="font-size: 0.75rem; color: var(--text-muted);">Refunds</div>
                            </div>
                            <div style="background: var(--bg-card); padding: 12px; border-radius: 8px;">
                                <div style="font-size: 1.25rem; font-weight: 600;">${current.gmv > 0 ? ((current.refunds / current.gmv) * 100).toFixed(1) : 0}%</div>
                                <div style="font-size: 0.75rem; color: var(--text-muted);">Refund Rate</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Top Videos -->
                ${videos && videos.length > 0 ? `
                <div style="background: var(--bg-secondary); padding: 16px; border-radius: 12px; margin-bottom: 24px;">
                    <div style="font-weight: 600; margin-bottom: 12px;">🎬 Top Performing Videos</div>
                    <div style="display: grid; gap: 8px;">
                        ${videos.map((v, i) => {
                            const hasVideo = v.video_id && v.video_id.toString().trim() !== '';
                            const mismatchBrand = v.likelyBrand; // Will be set if keywords suggest different brand
                            return `
                            <div style="display: flex; align-items: center; gap: 12px; padding: 10px; background: var(--bg-card); border-radius: 8px; ${hasVideo ? 'cursor: pointer;' : ''} ${mismatchBrand ? 'border: 1px solid var(--warning);' : ''}" ${hasVideo ? `onclick="openVideoEmbed('${v.video_id}', '${(v.video_title || 'Untitled Video').replace(/'/g, "\\'")}', ${v.gmv || 0}, ${v.orders || 0}, '${creatorName.replace(/'/g, "\\'")}')"` : ''}>
                                <div style="font-weight: 600; color: ${i < 3 ? 'var(--accent)' : 'var(--text-muted)'}; min-width: 28px;">#${i + 1}</div>
                                <div style="flex: 1; min-width: 0;">
                                    <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                                        <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-primary); max-width: 280px;" title="${(v.video_title || 'Untitled Video').replace(/"/g, '&quot;')}">
                                            ${(v.video_title || 'Untitled Video').substring(0, 50)}${(v.video_title || '').length > 50 ? '...' : ''}
                                        </span>
                                        ${hasVideo ? '<span style="color: var(--accent); font-size: 0.8rem;">▶</span>' : ''}
                                        ${mismatchBrand ? `<span style="font-size: 0.65rem; background: var(--warning-dim); color: var(--warning); padding: 2px 6px; border-radius: 4px;" title="Video may belong to ${BRAND_DISPLAY[mismatchBrand] || mismatchBrand} based on content">⚠️ Check brand</span>` : ''}
                                    </div>
                                    <div style="font-size: 0.75rem; color: var(--text-muted);">${fmt(v.orders || 0)} orders</div>
                                </div>
                                <div style="text-align: right; flex-shrink: 0;">
                                    <div style="font-weight: 600; color: var(--accent);">${fmtMoney(v.gmv)}</div>
                                </div>
                            </div>
                        `;}).join('')}
                    </div>
                </div>
                ` : ''}

                <!-- Notes Section -->
                <div style="background: var(--bg-secondary); padding: 16px; border-radius: 12px; margin-bottom: 24px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <div style="font-weight: 600;">📝 Notes</div>
                        <button class="btn btn-secondary" style="padding: 6px 12px; font-size: 0.85rem;" onclick="showAddNoteForm('${creatorName.replace(/'/g, "\\'")}')">+ Add Note</button>
                    </div>
                    <div id="creatorNotesContainer">
                        ${notes && notes.length > 0 ? notes.map(n => `
                            <div style="padding: 12px; background: var(--bg-card); border-radius: 8px; margin-bottom: 8px; position: relative;">
                                <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 6px;">
                                    ${new Date(n.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                </div>
                                <div style="white-space: pre-wrap;">${n.note}</div>
                                <button onclick="deleteNote(${n.id})" style="position: absolute; top: 8px; right: 8px; background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 1rem;" title="Delete note">×</button>
                            </div>
                        `).join('') : '<div style="color: var(--text-muted); text-align: center; padding: 20px;">No notes yet</div>'}
                    </div>
                    <div id="addNoteForm" style="display: none; margin-top: 12px;">
                        <textarea id="newNoteText" class="form-input" rows="3" placeholder="Add a note about this creator..." style="width: 100%; resize: vertical;"></textarea>
                        <div style="display: flex; gap: 8px; margin-top: 8px;">
                            <button class="btn btn-primary" onclick="saveCreatorNote('${creatorName.replace(/'/g, "\\'")}', '${brand}')">Save Note</button>
                            <button class="btn btn-secondary" onclick="hideAddNoteForm()">Cancel</button>
                        </div>
                    </div>
                </div>

                <!-- Action Buttons -->
                <div style="display: flex; gap: 12px; flex-wrap: wrap; padding-top: 16px; border-top: 1px solid var(--border);">
                    ${!managed ? `
                        <button class="btn btn-primary" onclick="quickAddToRoster('${creatorName.replace(/'/g, "\\'")}', '${brand}'); closeCreatorDetail();">
                            ➕ Add to Roster
                        </button>
                    ` : `
                        <button class="btn btn-secondary" onclick="editManagedCreator('${creatorName.replace(/'/g, "\\'")}'); closeCreatorDetail();">
                            ✏️ Edit in Roster
                        </button>
                    `}
                    <button class="btn btn-secondary" onclick="window.open('https://www.tiktok.com/@${creatorName}', '_blank')">
                        🔗 View TikTok Profile
                    </button>
                    <button class="btn btn-secondary" onclick="switchView('videos'); document.getElementById('videosSearchInput').value = '${creatorName.replace(/'/g, "\\'")}'; loadVideosData(); closeCreatorDetail();">
                        🎬 View All Videos
                    </button>
                </div>
            `;

            // Render the GMV trend chart
            setTimeout(() => {
                renderCreatorDetailChart(perfData);
            }, 100);
        }

        function renderCreatorDetailChart(perfData) {
            const ctx = document.getElementById('creatorDetailChart');
            if (!ctx) return;
            
            if (creatorDetailChartInstance) {
                creatorDetailChartInstance.destroy();
            }
            
            const labels = perfData.map(d => {
                const date = new Date(d.report_date + 'T00:00:00');
                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            });
            const values = perfData.map(d => pFloat(d.gmv));

            creatorDetailChartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'GMV',
                        data: values,
                        borderColor: '#f5c518',
                        backgroundColor: 'rgba(245, 197, 24, 0.1)',
                        fill: true,
                        tension: 0.3,
                        pointRadius: values.length > 14 ? 0 : 3,
                        pointBackgroundColor: '#f5c518'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: (ctx) => fmtMoney(ctx.raw)
                            }
                        }
                    },
                    scales: {
                        x: {
                            display: true,
                            grid: { display: false },
                            ticks: { 
                                color: '#9aa5b8',
                                maxRotation: 45,
                                maxTicksLimit: 7
                            }
                        },
                        y: {
                            display: true,
                            grid: { color: 'rgba(255,255,255,0.05)' },
                            ticks: {
                                color: '#9aa5b8',
                                callback: (v) => '$' + (v >= 1000 ? (v/1000).toFixed(0) + 'K' : v)
                            }
                        }
                    }
                }
            });
        }

        function showAddNoteForm(creatorName) {
            document.getElementById('addNoteForm').style.display = 'block';
            document.getElementById('newNoteText').focus();
        }

        function hideAddNoteForm() {
            document.getElementById('addNoteForm').style.display = 'none';
            document.getElementById('newNoteText').value = '';
        }

        async function saveCreatorNote(creatorName, brand) {
            const noteText = document.getElementById('newNoteText').value.trim();
            if (!noteText) {
                showToast('Please enter a note', 'error');
                return;
            }
            
            const { error } = await supabaseClient.from('creator_notes').insert({
                creator_name: creatorName,
                brand: brand,
                note: noteText
            });
            
            if (error) {
                showToast('Error saving note: ' + error.message, 'error');
                return;
            }
            
            showToast('Note saved!', 'success');
            hideAddNoteForm();
            
            // Refresh the modal to show the new note
            openCreatorDetail(creatorName, brand);
        }

        async function deleteNote(noteId) {
            if (!confirm('Delete this note?')) return;
            
            const { error } = await supabaseClient.from('creator_notes').delete().eq('id', noteId);
            
            if (error) {
                showToast('Error deleting note: ' + error.message, 'error');
                return;
            }
            
            // Remove from DOM
            event.target.closest('div[style*="padding: 12px"]').remove();
            showToast('Note deleted', 'success');
        }

        function editManagedCreator(creatorName) {
            // Find the managed creator and open edit modal
            const info = getManagedInfo(creatorName);
            if (info && info.id) {
                switchView('roster');
                setTimeout(() => {
                    editCreator(info.id);
                }, 300);
            } else {
                showToast('Creator not found in roster', 'error');
            }
        }

        function closeCreatorDetail() {
            document.getElementById('creatorDetailModal').classList.remove('show');
            if (creatorDetailChartInstance) {
                creatorDetailChartInstance.destroy();
                creatorDetailChartInstance = null;
            }
        }
        
        // ==================== CREATOR DATA MANAGEMENT ====================
        function showChangeBrandModal() {
            const { name, brand } = currentCreatorDetail;
            if (!name || !brand) return;
            
            const brands = ['catakor', 'jiyu', 'physicians_choice', 'peach_slices', 'yerba_magic'];
            const otherBrands = brands.filter(b => b !== brand);
            
            const content = `
                <div style="text-align: center; padding: 20px;">
                    <div style="font-size: 2rem; margin-bottom: 16px;">🔄</div>
                    <h3 style="margin-bottom: 8px;">Change Brand for ${name}</h3>
                    <p style="color: var(--text-muted); margin-bottom: 24px;">
                        Current brand: <strong>${BRAND_DISPLAY[brand] || brand}</strong><br>
                        This will update all creator_performance and video_performance records.
                    </p>
                    <div style="margin-bottom: 24px;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 500;">Select new brand:</label>
                        <select id="newBrandSelect" class="form-input" style="width: 100%; max-width: 300px; margin: 0 auto;">
                            ${otherBrands.map(b => `<option value="${b}">${BRAND_DISPLAY[b] || b}</option>`).join('')}
                        </select>
                    </div>
                    <div style="display: flex; gap: 12px; justify-content: center;">
                        <button class="btn btn-secondary" onclick="closeConfirmModal()">Cancel</button>
                        <button class="btn btn-primary" onclick="executeChangeBrand('${name}', '${brand}')">
                            Change Brand
                        </button>
                    </div>
                </div>
            `;
            
            showConfirmModal(content);
        }
        
        async function executeChangeBrand(creatorName, oldBrand) {
            const newBrand = document.getElementById('newBrandSelect').value;
            if (!newBrand || newBrand === oldBrand) {
                showToast('Please select a different brand', 'error');
                return;
            }
            
            closeConfirmModal();
            showToast('Updating brand...', 'info');
            
            try {
                // Update creator_performance records
                const { error: cpError } = await supabaseClient
                    .from('creator_performance')
                    .update({ brand: newBrand })
                    .eq('creator_name', creatorName)
                    .eq('brand', oldBrand);
                
                if (cpError) throw cpError;
                
                // Update video_performance records
                const { error: vpError } = await supabaseClient
                    .from('video_performance')
                    .update({ brand: newBrand })
                    .ilike('creator_name', creatorName)
                    .eq('brand', oldBrand);
                
                if (vpError) throw vpError;
                
                showToast(`✅ Brand changed to ${BRAND_DISPLAY[newBrand]}`, 'success');
                
                // Close modal and refresh
                closeCreatorDetail();
                currentCreatorDetail = { name: null, brand: null };
                
                // Refresh creators view if active
                if (window.creatorsDataLoaded) loadCreatorsData();
                
            } catch (err) {
                console.error('Change brand error:', err);
                showToast(`Error: ${err.message}`, 'error');
            }
        }
        
        function confirmRemoveCreator() {
            const { name, brand } = currentCreatorDetail;
            if (!name || !brand) return;
            
            const content = `
                <div style="text-align: center; padding: 20px;">
                    <div style="font-size: 2rem; margin-bottom: 16px;">⚠️</div>
                    <h3 style="margin-bottom: 8px; color: var(--danger);">Remove Creator Data</h3>
                    <p style="color: var(--text-muted); margin-bottom: 16px;">
                        This will permanently delete all data for:<br>
                        <strong style="color: var(--text-primary);">${name}</strong> (${BRAND_DISPLAY[brand] || brand})
                    </p>
                    <div style="background: var(--danger-dim); border: 1px solid var(--danger); border-radius: 8px; padding: 12px; margin-bottom: 24px;">
                        <div style="font-size: 0.85rem; color: var(--danger);">
                            ⚠️ This action cannot be undone!<br>
                            All performance data and video records will be deleted.
                        </div>
                    </div>
                    <div style="display: flex; gap: 12px; justify-content: center;">
                        <button class="btn btn-secondary" onclick="closeConfirmModal()">Cancel</button>
                        <button class="btn" style="background: var(--danger); color: white;" onclick="executeRemoveCreator('${name.replace(/'/g, "\\'")}', '${brand}')">
                            🗑️ Delete Permanently
                        </button>
                    </div>
                </div>
            `;
            
            showConfirmModal(content);
        }
        
        async function executeRemoveCreator(creatorName, brand) {
            closeConfirmModal();
            showToast('Removing creator data...', 'info');
            
            try {
                // Delete creator_performance records
                const { error: cpError, count: cpCount } = await supabaseClient
                    .from('creator_performance')
                    .delete()
                    .eq('creator_name', creatorName)
                    .eq('brand', brand);
                
                if (cpError) throw cpError;
                
                // Delete video_performance records
                const { error: vpError, count: vpCount } = await supabaseClient
                    .from('video_performance')
                    .delete()
                    .ilike('creator_name', creatorName)
                    .eq('brand', brand);
                
                if (vpError) throw vpError;
                
                showToast(`✅ Removed ${creatorName} from ${BRAND_DISPLAY[brand]}`, 'success');
                
                // Close modal and refresh
                closeCreatorDetail();
                currentCreatorDetail = { name: null, brand: null };
                
                // Refresh creators view if active
                if (window.creatorsDataLoaded) loadCreatorsData();
                
            } catch (err) {
                console.error('Remove creator error:', err);
                showToast(`Error: ${err.message}`, 'error');
            }
        }
        
        function showConfirmModal(content) {
            // Create a simple confirmation modal overlay
            let modal = document.getElementById('confirmActionModal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'confirmActionModal';
                modal.className = 'modal-overlay';
                modal.innerHTML = `<div class="modal" style="max-width: 450px;"><div class="modal-body" id="confirmActionBody"></div></div>`;
                document.body.appendChild(modal);
            }
            document.getElementById('confirmActionBody').innerHTML = content;
            modal.classList.add('show');
        }
        
        function closeConfirmModal() {
            const modal = document.getElementById('confirmActionModal');
            if (modal) modal.classList.remove('show');
        }

        // ==================== VIDEO PLAYER ====================
        function openVideoLink(url) {
            console.log('Opening video link:', url);
            if (!url || url === 'null' || url === 'undefined') {
                showToast('No video link available', 'error');
                return;
            }
            // Decode the URI in case it was encoded
            const decodedUrl = decodeURI(url);
            console.log('Decoded URL:', decodedUrl);
            
            // Open in new tab
            const newWindow = window.open(decodedUrl, '_blank');
            if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
                // Popup was blocked
                showToast('Popup blocked - click the link below', 'warning');
                // Create a temporary link as fallback
                const tempLink = document.createElement('a');
                tempLink.href = decodedUrl;
                tempLink.target = '_blank';
                tempLink.click();
            }
        }
        
        let currentVideoUrl = '';
        
        function openVideoEmbed(videoId, title, gmv, orders, creatorName) {
            const modal = document.getElementById('videoPlayerModal');
            const content = document.getElementById('videoPlayerContent');
            const titleEl = document.getElementById('videoPlayerTitle');
            const statsEl = document.getElementById('videoPlayerStats');
            const linkEl = document.getElementById('videoPlayerLink');
            
            // Build and store the URL
            currentVideoUrl = `https://www.tiktok.com/@${creatorName}/video/${videoId}`;
            
            // Set title and stats
            titleEl.textContent = title || 'TikTok Video';
            titleEl.title = title || 'TikTok Video';
            statsEl.innerHTML = `${fmtMoney(gmv)} GMV • ${fmt(orders)} orders`;
            linkEl.href = currentVideoUrl;
            
            if (videoId) {
                // Use TikTok's embed
                content.innerHTML = `
                    <iframe 
                        src="https://www.tiktok.com/embed/v2/${videoId}" 
                        style="width: 100%; height: 100%; border: none;"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowfullscreen>
                    </iframe>
                `;
            } else {
                content.innerHTML = `
                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 20px; text-align: center; color: var(--text-muted);">
                        <div style="font-size: 3rem; margin-bottom: 16px;">🎬</div>
                        <div>No video ID available</div>
                    </div>
                `;
            }
            
            modal.classList.add('show');
        }
        
        function copyVideoUrl() {
            if (currentVideoUrl) {
                navigator.clipboard.writeText(currentVideoUrl).then(() => {
                    showToast('URL copied to clipboard!', 'success');
                }).catch(() => {
                    showToast('Failed to copy URL', 'error');
                });
            }
        }

        // ==================== PDF EXPORT ====================
        function exportToPDF(viewId, title) {
            // Add print header
            const printHeader = document.createElement('div');
            printHeader.className = 'print-header';
            printHeader.innerHTML = `
                <img src="logo.png" alt="Creators Corner" onerror="this.outerHTML='<strong style=\\'color:#f5c518;font-size:1.5rem;\\'>CREATORS CORNER</strong>'">
                <h1>${title}</h1>
                <p>Generated: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            `;
            
            const viewSection = document.getElementById(viewId);
            viewSection.insertBefore(printHeader, viewSection.firstChild);
            
            // Mark view as print-active
            document.querySelectorAll('.view-section').forEach(v => v.classList.remove('print-active'));
            viewSection.classList.add('print-active');
            
            // Trigger print
            window.print();
            
            // Cleanup
            setTimeout(() => {
                printHeader.remove();
                viewSection.classList.remove('print-active');
            }, 100);
        }

        // ==================== COMPARISON MODE ====================
        let comparePickers = {};
        
        function openComparisonModal() {
            document.getElementById('comparisonModal').classList.add('show');
            document.getElementById('comparisonResults').style.display = 'none';
            
            const dates = availableDates.daily || [];
            if (dates.length < 2) return;
            
            const sortedDates = [...dates].sort();
            const minDate = sortedDates[0];
            const maxDate = sortedDates[sortedDates.length - 1];
            
            // Default: Period A = last 7 days, Period B = 7 days before that
            const today = new Date();
            const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);
            const twoWeeksAgo = new Date(today); twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
            
            const config = (defaultDate) => ({
                dateFormat: 'Y-m-d',
                altInput: true,
                altFormat: 'M j',
                minDate: minDate,
                maxDate: maxDate,
                defaultDate: defaultDate
            });
            
            // Destroy existing pickers
            Object.values(comparePickers).forEach(p => p?.destroy?.());
            
            comparePickers.startA = flatpickr('#compareStartA', config(localDateStr(weekAgo)));
            comparePickers.endA = flatpickr('#compareEndA', config(localDateStr(today)));
            comparePickers.startB = flatpickr('#compareStartB', config(localDateStr(twoWeeksAgo)));
            comparePickers.endB = flatpickr('#compareEndB', config(localDateStr(weekAgo)));
        }
        
        function closeComparisonModal() {
            document.getElementById('comparisonModal').classList.remove('show');
        }
        
        async function runComparison() {
            const startA = document.getElementById('compareStartA').value;
            const endA = document.getElementById('compareEndA').value;
            const startB = document.getElementById('compareStartB').value;
            const endB = document.getElementById('compareEndB').value;
            
            if (!startA || !endA || !startB || !endB) {
                showToast('Please select all dates', 'error');
                return;
            }
            
            // Fetch Period A data
            const { data: dataA } = await supabaseClient.from('creator_performance')
                .select('*')
                .gte('report_date', startA)
                .lte('report_date', endA)
                .eq('period_type', 'daily');
            
            // Fetch Period B data
            const { data: dataB } = await supabaseClient.from('creator_performance')
                .select('*')
                .gte('report_date', startB)
                .lte('report_date', endB)
                .eq('period_type', 'daily');
            
            // Aggregate
            const aggregate = (data) => ({
                gmv: (data || []).reduce((s, d) => s + (d.gmv || 0), 0),
                orders: (data || []).reduce((s, d) => s + (d.orders || 0), 0),
                videos: (data || []).reduce((s, d) => s + (d.videos || 0), 0),
                creators: new Set((data || []).map(d => d.creator_name)).size
            });
            
            const statsA = aggregate(dataA);
            const statsB = aggregate(dataB);
            
            // Calculate changes
            const pctChange = (a, b) => b > 0 ? ((a - b) / b * 100) : (a > 0 ? 100 : 0);
            
            const renderStats = (stats, label) => `
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
                    <div style="background: var(--bg-secondary); padding: 12px; border-radius: 8px;">
                        <div style="font-size: 1.3rem; font-weight: 700; color: var(--accent);">${fmtMoney(stats.gmv)}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">GMV</div>
                    </div>
                    <div style="background: var(--bg-secondary); padding: 12px; border-radius: 8px;">
                        <div style="font-size: 1.3rem; font-weight: 700;">${fmt(stats.orders)}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">Orders</div>
                    </div>
                    <div style="background: var(--bg-secondary); padding: 12px; border-radius: 8px;">
                        <div style="font-size: 1.3rem; font-weight: 700;">${stats.videos}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">Videos</div>
                    </div>
                    <div style="background: var(--bg-secondary); padding: 12px; border-radius: 8px;">
                        <div style="font-size: 1.3rem; font-weight: 700;">${stats.creators}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">Creators</div>
                    </div>
                </div>
            `;
            
            document.getElementById('comparisonA').innerHTML = renderStats(statsA, 'A');
            document.getElementById('comparisonB').innerHTML = renderStats(statsB, 'B');
            
            const gmvChange = pctChange(statsA.gmv, statsB.gmv);
            const ordersChange = pctChange(statsA.orders, statsB.orders);
            const videosChange = pctChange(statsA.videos, statsB.videos);
            const creatorsChange = pctChange(statsA.creators, statsB.creators);
            
            const changeClass = (val) => val >= 0 ? 'color: var(--success)' : 'color: var(--danger)';
            const changeIcon = (val) => val >= 0 ? '↑' : '↓';
            
            document.getElementById('comparisonSummary').innerHTML = `
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; text-align: center;">
                    <div>
                        <div style="font-size: 1.5rem; font-weight: 700; ${changeClass(gmvChange)}">${changeIcon(gmvChange)} ${Math.abs(gmvChange).toFixed(1)}%</div>
                        <div style="font-size: 0.8rem; color: var(--text-muted);">GMV</div>
                    </div>
                    <div>
                        <div style="font-size: 1.5rem; font-weight: 700; ${changeClass(ordersChange)}">${changeIcon(ordersChange)} ${Math.abs(ordersChange).toFixed(1)}%</div>
                        <div style="font-size: 0.8rem; color: var(--text-muted);">Orders</div>
                    </div>
                    <div>
                        <div style="font-size: 1.5rem; font-weight: 700; ${changeClass(videosChange)}">${changeIcon(videosChange)} ${Math.abs(videosChange).toFixed(1)}%</div>
                        <div style="font-size: 0.8rem; color: var(--text-muted);">Videos</div>
                    </div>
                    <div>
                        <div style="font-size: 1.5rem; font-weight: 700; ${changeClass(creatorsChange)}">${changeIcon(creatorsChange)} ${Math.abs(creatorsChange).toFixed(1)}%</div>
                        <div style="font-size: 0.8rem; color: var(--text-muted);">Creators</div>
                    </div>
                </div>
                <p style="margin-top: 16px; color: var(--text-secondary); font-size: 0.85rem;">
                    Comparing <strong>Period A</strong> (${formatDate(startA)} → ${formatDate(endA)}) against <strong>Period B</strong> (${formatDate(startB)} → ${formatDate(endB)})
                </p>
            `;
            
            document.getElementById('comparisonResults').style.display = 'block';
        }

        // ==================== SETTINGS TAB SWITCHING ====================
        let settingsProductsLoaded = false;
        
        function switchSettingsTab(tab) {
            // Update tab styling
            document.querySelectorAll('.settings-tab').forEach(t => {
                t.classList.remove('active');
                t.style.background = 'transparent';
                t.style.color = 'var(--text-muted)';
            });
            const activeTab = document.querySelector(`.settings-tab[data-tab="${tab}"]`);
            if (activeTab) {
                activeTab.classList.add('active');
                activeTab.style.background = 'var(--bg-card)';
                activeTab.style.color = 'var(--text-primary)';
            }
            
            // Show/hide tab content
            document.querySelectorAll('.settings-tab-content').forEach(c => c.style.display = 'none');
            const content = document.getElementById(`settings-tab-${tab}`);
            if (content) content.style.display = 'block';
            
            // Load data for specific tabs
            if (tab === 'products' && !settingsProductsLoaded) {
                settingsProductsLoaded = true;
                loadSettingsProducts();
            }
            if (tab === 'notifications') {
                renderDiscordRoutingTable();
            }
            if (tab === 'brands') {
                updateBrandSettings();
            }
            if (tab === 'application') {
                loadBrandAppSettings();
                renderBrandQuickLinks();
            }
        }
        
        // ==================== BRAND APPLICATION SETTINGS ====================
        let currentBrandAppSettings = {};
        let customFieldsCounter = 0;
        
        function loadBrandAppSettings() {
            const brand = document.getElementById('appSettingsBrandSelect')?.value || 'default';
            
            // Load from localStorage (could be database in future)
            const allSettings = JSON.parse(localStorage.getItem('brandAppSettings') || '{}');
            currentBrandAppSettings = allSettings[brand] || {};
            
            // Populate form fields
            document.getElementById('appSettingsTitle').value = currentBrandAppSettings.title || '';
            document.getElementById('appSettingsSubtitle').value = currentBrandAppSettings.subtitle || '';
            document.getElementById('appSettingsLogo').value = currentBrandAppSettings.logo || '';
            document.getElementById('appSettingsColor').value = currentBrandAppSettings.color || '#f5c518';
            document.getElementById('appSettingsColorText').value = currentBrandAppSettings.color || '#f5c518';
            document.getElementById('appSettingsWelcomeVideo').value = currentBrandAppSettings.welcome_video || '';
            document.getElementById('appSettingsThankYouVideo').value = currentBrandAppSettings.thank_you_video || '';
            document.getElementById('appSettingsSuccessTitle').value = currentBrandAppSettings.success_title || '';
            document.getElementById('appSettingsSuccessMsg').value = currentBrandAppSettings.success_message || '';
            document.getElementById('appSettingsDiscordClientId').value = currentBrandAppSettings.discord_client_id || '';
            
            // Load custom fields
            renderCustomFields(currentBrandAppSettings.custom_fields || []);
            
            // Sync color inputs
            document.getElementById('appSettingsColor').addEventListener('input', function() {
                document.getElementById('appSettingsColorText').value = this.value;
            });
        }
        
        function saveBrandAppSettings() {
            const brand = document.getElementById('appSettingsBrandSelect')?.value || 'default';
            
            // Collect settings
            const settings = {
                title: document.getElementById('appSettingsTitle').value.trim(),
                subtitle: document.getElementById('appSettingsSubtitle').value.trim(),
                logo: document.getElementById('appSettingsLogo').value.trim(),
                color: document.getElementById('appSettingsColorText').value.trim() || document.getElementById('appSettingsColor').value,
                welcome_video: document.getElementById('appSettingsWelcomeVideo').value.trim(),
                thank_you_video: document.getElementById('appSettingsThankYouVideo').value.trim(),
                success_title: document.getElementById('appSettingsSuccessTitle').value.trim(),
                success_message: document.getElementById('appSettingsSuccessMsg').value.trim(),
                discord_client_id: document.getElementById('appSettingsDiscordClientId').value.trim(),
                custom_fields: collectCustomFields()
            };
            
            // Save to localStorage
            const allSettings = JSON.parse(localStorage.getItem('brandAppSettings') || '{}');
            allSettings[brand] = settings;
            localStorage.setItem('brandAppSettings', JSON.stringify(allSettings));
            
            currentBrandAppSettings = settings;
            
            // Show success message
            const status = document.getElementById('appSettingsStatus');
            status.innerHTML = '<span style="color: var(--success);">✅ Settings saved!</span>';
            setTimeout(() => { status.innerHTML = ''; }, 3000);
            
            showToast(`${brand === 'default' ? 'Default' : BRAND_DISPLAY[brand]} application settings saved!`, 'success');
        }
        
        function resetBrandAppSettings() {
            const brand = document.getElementById('appSettingsBrandSelect')?.value || 'default';
            if (!confirm(`Reset ${brand === 'default' ? 'default' : BRAND_DISPLAY[brand]} application settings to blank?`)) return;
            
            const allSettings = JSON.parse(localStorage.getItem('brandAppSettings') || '{}');
            delete allSettings[brand];
            localStorage.setItem('brandAppSettings', JSON.stringify(allSettings));
            
            loadBrandAppSettings();
            showToast('Settings reset', 'success');
        }
        
        function collectCustomFields() {
            const fields = [];
            document.querySelectorAll('.custom-field-item').forEach(item => {
                fields.push({
                    id: item.dataset.fieldId,
                    label: item.querySelector('.field-label-input')?.value || '',
                    type: item.querySelector('.field-type-select')?.value || 'text',
                    required: item.querySelector('.field-required-check')?.checked || false,
                    placeholder: item.querySelector('.field-placeholder-input')?.value || ''
                });
            });
            return fields;
        }
        
        function renderCustomFields(fields) {
            const container = document.getElementById('customFieldsList');
            if (!fields || fields.length === 0) {
                container.innerHTML = '<div style="color: var(--text-muted); font-size: 0.9rem; padding: 12px; background: var(--bg-secondary); border-radius: 8px; text-align: center;">No custom fields. Standard fields (Name, Email, TikTok, Brand) are always included.</div>';
                return;
            }
            
            container.innerHTML = fields.map((f, i) => `
                <div class="custom-field-item" data-field-id="${f.id || 'field_' + i}" style="padding: 16px; background: var(--bg-secondary); border-radius: 10px; display: grid; grid-template-columns: 1fr 120px 80px auto; gap: 12px; align-items: center;">
                    <input type="text" class="form-input field-label-input" placeholder="Field Label" value="${f.label || ''}" style="font-size: 0.9rem;">
                    <select class="form-input field-type-select" style="font-size: 0.85rem;">
                        <option value="text" ${f.type === 'text' ? 'selected' : ''}>Text</option>
                        <option value="textarea" ${f.type === 'textarea' ? 'selected' : ''}>Long Text</option>
                        <option value="number" ${f.type === 'number' ? 'selected' : ''}>Number</option>
                        <option value="select" ${f.type === 'select' ? 'selected' : ''}>Dropdown</option>
                    </select>
                    <label style="display: flex; align-items: center; gap: 6px; font-size: 0.8rem; cursor: pointer;">
                        <input type="checkbox" class="field-required-check" ${f.required ? 'checked' : ''}> Required
                    </label>
                    <button class="btn" onclick="removeCustomField(this)" style="padding: 6px 10px; color: var(--danger);">🗑️</button>
                </div>
            `).join('');
        }
        
        function addCustomField() {
            const container = document.getElementById('customFieldsList');
            
            // Remove empty state message if present
            if (container.querySelector('div[style*="text-align: center"]')) {
                container.innerHTML = '';
            }
            
            const fieldId = 'custom_' + Date.now();
            const html = `
                <div class="custom-field-item" data-field-id="${fieldId}" style="padding: 16px; background: var(--bg-secondary); border-radius: 10px; display: grid; grid-template-columns: 1fr 120px 80px auto; gap: 12px; align-items: center;">
                    <input type="text" class="form-input field-label-input" placeholder="Field Label (e.g., Follower Count)" style="font-size: 0.9rem;">
                    <select class="form-input field-type-select" style="font-size: 0.85rem;">
                        <option value="text">Text</option>
                        <option value="textarea">Long Text</option>
                        <option value="number">Number</option>
                        <option value="select">Dropdown</option>
                    </select>
                    <label style="display: flex; align-items: center; gap: 6px; font-size: 0.8rem; cursor: pointer;">
                        <input type="checkbox" class="field-required-check"> Required
                    </label>
                    <button class="btn" onclick="removeCustomField(this)" style="padding: 6px 10px; color: var(--danger);">🗑️</button>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', html);
        }
        
        function removeCustomField(btn) {
            btn.closest('.custom-field-item').remove();
            
            // Show empty state if no fields left
            const container = document.getElementById('customFieldsList');
            if (container.children.length === 0) {
                container.innerHTML = '<div style="color: var(--text-muted); font-size: 0.9rem; padding: 12px; background: var(--bg-secondary); border-radius: 8px; text-align: center;">No custom fields. Standard fields (Name, Email, TikTok, Brand) are always included.</div>';
            }
        }
        
        function renderBrandQuickLinks() {
            const brands = [
                { key: 'catakor', name: 'Cata-Kor', icon: '💊' },
                { key: 'jiyu', name: 'JiYu', icon: '✨' },
                { key: 'physicians_choice', name: 'Physicians Choice', icon: '🩺' },
                { key: 'peach_slices', name: 'Peach Slices', icon: '🍑' },
                { key: 'yerba_magic', name: 'Yerba Magic', icon: '🧉' },
                { key: 'toplux', name: 'Toplux Nutrition', icon: '⚡' }
            ];
            
            const baseUrl = window.location.origin;
            const container = document.getElementById('brandQuickLinks');
            
            container.innerHTML = brands.map(b => `
                <div style="padding: 14px; background: var(--bg-secondary); border-radius: 10px; display: flex; justify-content: space-between; align-items: center; gap: 12px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 1.1rem;">${b.icon}</span>
                        <span style="font-weight: 500;">${b.name}</span>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn" onclick="copyToClipboard('${baseUrl}/apply?brand=${b.key}')" style="padding: 6px 10px; font-size: 0.8rem;">📋 Copy</button>
                        <button class="btn" onclick="window.open('/apply?brand=${b.key}', '_blank')" style="padding: 6px 10px; font-size: 0.8rem;">👁️</button>
                    </div>
                </div>
            `).join('');
        }
        
        function testApplyPageFromSettings() {
            const brand = document.getElementById('appSettingsBrandSelect')?.value || 'default';
            if (brand === 'default') {
                window.open('/apply', '_blank');
            } else {
                window.open('/apply?brand=' + brand, '_blank');
            }
        }
        
        // ==================== BRAND SETTINGS ====================
        async function updateBrandSettings() {
            const brand = document.getElementById('brandSettingsSelect')?.value || 'catakor';
            const baseUrl = window.location.origin;
            
            // Update URLs
            document.getElementById('brandApplyUrl').textContent = `${baseUrl}/apply?brand=${brand}`;
            document.getElementById('brandPortalUrl').textContent = `${baseUrl}/brand-portal?brand=${brand}`;
            
            // Update info cards
            const config = {
                'catakor': { icon: '💊', color: '#e74c3c', name: 'Cata-Kor' },
                'jiyu': { icon: '✨', color: '#9b59b6', name: 'JiYu' },
                'physicians_choice': { icon: '🩺', color: '#3498db', name: 'Physicians Choice' },
                'peach_slices': { icon: '🍑', color: '#ff6b9d', name: 'Peach Slices' },
                'yerba_magic': { icon: '🧉', color: '#2ecc71', name: 'Yerba Magic' },
                'toplux': { icon: '⚡', color: '#00b894', name: 'Toplux Nutrition' }
            };
            
            const c = config[brand] || { icon: '🏷️', color: '#888', name: brand };
            
            document.getElementById('brandInfoCards').innerHTML = `
                <div style="background: linear-gradient(135deg, ${c.color}20 0%, ${c.color}10 100%); border: 1px solid ${c.color}40; border-radius: 12px; padding: 20px; text-align: center;">
                    <div style="font-size: 2rem; margin-bottom: 8px;">${c.icon}</div>
                    <div style="font-weight: 700; color: ${c.color};">${c.name}</div>
                </div>
            `;
            
            // Load stats for this brand
            try {
                // Get creator count
                const { data: creators } = await supabaseClient
                    .from('creator_roster')
                    .select('id')
                    .eq('brand', brand);
                document.getElementById('brandStatCreators').textContent = creators?.length || 0;
                
                // Get 30-day GMV
                const endDate = new Date();
                const startDate = new Date();
                startDate.setDate(startDate.getDate() - 30);
                
                const { data: perfData } = await supabaseClient
                    .from('creator_performance')
                    .select('gmv')
                    .eq('brand', brand)
                    .eq('period_type', 'daily')
                    .gte('report_date', startDate.toISOString().split('T')[0])
                    .lte('report_date', endDate.toISOString().split('T')[0]);
                
                const totalGMV = perfData?.reduce((sum, r) => sum + (parseFloat(r.gmv) || 0), 0) || 0;
                document.getElementById('brandStatGMV').textContent = fmtMoney(totalGMV);
                
                // Get product count
                const { data: products } = await supabaseClient
                    .from('products')
                    .select('id')
                    .eq('brand', brand);
                document.getElementById('brandStatProducts').textContent = products?.length || 0;
                
                // Get pending applications
                const { data: apps } = await supabaseClient
                    .from('creator_applications')
                    .select('id')
                    .eq('brand', brand)
                    .eq('status', 'pending');
                document.getElementById('brandStatApps').textContent = apps?.length || 0;
                
            } catch (err) {
                console.error('Error loading brand stats:', err);
            }
        }
        
        function copyBrandApplyLink() {
            const brand = document.getElementById('brandSettingsSelect')?.value || 'catakor';
            const link = `${window.location.origin}/apply?brand=${brand}`;
            navigator.clipboard.writeText(link).then(() => {
                showToast(`${BRAND_DISPLAY[brand]} apply link copied!`, 'success');
            });
        }
        
        function copyBrandPortalLink() {
            const brand = document.getElementById('brandSettingsSelect')?.value || 'catakor';
            const link = `${window.location.origin}/brand-portal?brand=${brand}`;
            navigator.clipboard.writeText(link).then(() => {
                showToast(`${BRAND_DISPLAY[brand]} portal link copied!`, 'success');
            });
        }
        
        function openBrandPortalLink() {
            const brand = document.getElementById('brandSettingsSelect')?.value || 'catakor';
            window.open(`/brand-portal?brand=${brand}`, '_blank');
        }
        
        function testApplyPage() {
            const brand = document.getElementById('brandSettingsSelect')?.value || 'catakor';
            window.open(`/apply?brand=${brand}`, '_blank');
        }

        // ==================== DISCORD WEBHOOKS MANAGEMENT ====================
        let discordWebhooks = [];
        let notificationLog = [];
        
        function loadDiscordSettings() {
            // Load webhooks from localStorage
            discordWebhooks = JSON.parse(localStorage.getItem('discordWebhooks') || '[]');
            
            // Migrate old single webhook if exists
            const oldWebhook = localStorage.getItem('discordWebhook');
            if (oldWebhook && discordWebhooks.length === 0) {
                discordWebhooks.push({
                    id: 'migrated-' + Date.now(),
                    label: 'Main Webhook',
                    url: oldWebhook,
                    forWins: true,
                    forAlerts: true,
                    forReports: true,
                    forApplications: true,
                    brand: 'all'
                });
                localStorage.setItem('discordWebhooks', JSON.stringify(discordWebhooks));
            }
            
            // Load notification log
            notificationLog = JSON.parse(localStorage.getItem('notificationLog') || '[]');
            
            renderWebhooksList();
            renderNotificationLog();
        }
        
        function renderWebhooksList() {
            const container = document.getElementById('discordWebhooksList');
            const noWebhooksMsg = document.getElementById('noWebhooksMessage');
            
            if (!container) return;
            
            if (discordWebhooks.length === 0) {
                container.innerHTML = '';
                if (noWebhooksMsg) noWebhooksMsg.style.display = 'block';
                return;
            }
            
            if (noWebhooksMsg) noWebhooksMsg.style.display = 'none';
            
            container.innerHTML = discordWebhooks.map(w => {
                const tags = [];
                if (w.forWins) tags.push('🏆 Wins');
                if (w.forAlerts) tags.push('🚨 Alerts');
                if (w.forReports) tags.push('📊 Reports');
                if (w.forApplications) tags.push('📝 Apps');
                
                const brandTag = w.brand !== 'all' ? `<span style="background: var(--accent); color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.65rem; margin-left: 6px;">${BRAND_DISPLAY[w.brand] || w.brand}</span>` : '';
                
                return `
                    <div style="display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--bg-secondary); border-radius: 8px; margin-bottom: 8px;">
                        <div style="width: 36px; height: 36px; background: #5865F2; border-radius: 6px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.36-.698.772-1.362 1.225-1.993a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.12-.094.246-.194.373-.292a.074.074 0 0 1 .078-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.06.06 0 0 0-.031-.03z"/></svg>
                        </div>
                        <div style="flex: 1; min-width: 0;">
                            <div style="font-weight: 500; display: flex; align-items: center;">${sanitize(w.label)}${brandTag}</div>
                            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">${tags.join(' • ') || 'No events selected'}</div>
                        </div>
                        <button class="btn btn-sm" onclick="editWebhook('${w.id}')" style="padding: 6px 10px;">Edit</button>
                        <button class="btn btn-sm" onclick="deleteWebhook('${w.id}')" style="padding: 6px 10px; color: var(--error);">×</button>
                    </div>
                `;
            }).join('');
        }
        
        function openAddWebhookModal() {
            document.getElementById('webhookModalTitle').textContent = 'Add Discord Webhook';
            document.getElementById('webhookId').value = '';
            document.getElementById('webhookLabel').value = '';
            document.getElementById('webhookUrl').value = '';
            document.getElementById('webhookForWins').checked = true;
            document.getElementById('webhookForAlerts').checked = true;
            document.getElementById('webhookForReports').checked = false;
            document.getElementById('webhookForApplications').checked = false;
            document.getElementById('webhookBrand').value = 'all';
            document.getElementById('webhookModal').classList.add('show');
        }
        
        function editWebhook(id) {
            const webhook = discordWebhooks.find(w => w.id === id);
            if (!webhook) return;
            
            document.getElementById('webhookModalTitle').textContent = 'Edit Discord Webhook';
            document.getElementById('webhookId').value = webhook.id;
            document.getElementById('webhookLabel').value = webhook.label;
            document.getElementById('webhookUrl').value = webhook.url;
            document.getElementById('webhookForWins').checked = webhook.forWins;
            document.getElementById('webhookForAlerts').checked = webhook.forAlerts;
            document.getElementById('webhookForReports').checked = webhook.forReports;
            document.getElementById('webhookForApplications').checked = webhook.forApplications;
            document.getElementById('webhookBrand').value = webhook.brand || 'all';
            document.getElementById('webhookModal').classList.add('show');
        }
        
        function closeWebhookModal() {
            document.getElementById('webhookModal').classList.remove('show');
        }
        
        function saveWebhook() {
            const id = document.getElementById('webhookId').value || 'webhook-' + Date.now();
            const label = document.getElementById('webhookLabel').value.trim();
            const url = document.getElementById('webhookUrl').value.trim();
            
            if (!label || !url) {
                showToast('Please fill in label and URL', 'error');
                return;
            }
            
            if (!url.startsWith('https://discord.com/api/webhooks/')) {
                showToast('Invalid Discord webhook URL', 'error');
                return;
            }
            
            const webhookData = {
                id,
                label,
                url,
                forWins: document.getElementById('webhookForWins').checked,
                forAlerts: document.getElementById('webhookForAlerts').checked,
                forReports: document.getElementById('webhookForReports').checked,
                forApplications: document.getElementById('webhookForApplications').checked,
                brand: document.getElementById('webhookBrand').value
            };
            
            const existingIndex = discordWebhooks.findIndex(w => w.id === id);
            if (existingIndex >= 0) {
                discordWebhooks[existingIndex] = webhookData;
            } else {
                discordWebhooks.push(webhookData);
            }
            
            localStorage.setItem('discordWebhooks', JSON.stringify(discordWebhooks));
            showToast('Webhook saved!', 'success');
            closeWebhookModal();
            renderWebhooksList();
            renderDiscordRoutingTable();
        }
        
        function deleteWebhook(id) {
            if (!confirm('Delete this webhook?')) return;
            discordWebhooks = discordWebhooks.filter(w => w.id !== id);
            localStorage.setItem('discordWebhooks', JSON.stringify(discordWebhooks));
            showToast('Webhook deleted', 'success');
            renderWebhooksList();
            renderDiscordRoutingTable();
        }
        
        async function testWebhook() {
            const url = document.getElementById('webhookUrl').value.trim();
            const label = document.getElementById('webhookLabel').value.trim() || 'Test';
            
            if (!url) {
                showToast('Enter a webhook URL first', 'error');
                return;
            }
            
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        embeds: [{
                            title: '🧪 Test Connection',
                            description: `Webhook "${label}" is working!\nCreators Corner is connected.`,
                            color: 5763719,
                            footer: { text: 'Creators Corner Dashboard' },
                            timestamp: new Date().toISOString()
                        }]
                    })
                });
                
                if (response.ok) {
                    showToast('Test message sent! Check Discord.', 'success');
                } else {
                    showToast('Failed to send - check webhook URL', 'error');
                }
            } catch (err) {
                showToast('Error connecting to Discord', 'error');
            }
        }
        
        function renderDiscordRoutingTable() {
            const container = document.getElementById('discordRoutingTable');
            const statusEl = document.getElementById('discordRoutingStatus');
            
            if (!container) return;
            
            if (discordWebhooks.length === 0) {
                container.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--text-muted); background: var(--bg-secondary); border-radius: 8px;">
                    Add webhooks in <a href="#" onclick="switchSettingsTab('integrations'); return false;" style="color: var(--accent);">Integrations</a> to configure Discord routing
                </div>`;
                if (statusEl) statusEl.textContent = 'No webhooks configured';
                return;
            }
            
            if (statusEl) statusEl.textContent = `${discordWebhooks.length} webhook${discordWebhooks.length > 1 ? 's' : ''} configured`;
            
            const events = [
                { key: 'forWins', emoji: '🏆', label: 'Wins & Milestones' },
                { key: 'forAlerts', emoji: '🚨', label: 'Alerts & Issues' },
                { key: 'forReports', emoji: '📊', label: 'Weekly Reports' },
                { key: 'forApplications', emoji: '📝', label: 'New Applications' }
            ];
            
            container.innerHTML = `
                <div style="display: grid; gap: 8px;">
                    ${events.map(e => {
                        const webhooksForEvent = discordWebhooks.filter(w => w[e.key]);
                        return `
                            <div style="display: flex; align-items: center; gap: 12px; padding: 10px 12px; background: var(--bg-secondary); border-radius: 6px;">
                                <span style="font-size: 1.1rem;">${e.emoji}</span>
                                <span style="flex: 1; font-size: 0.9rem;">${e.label}</span>
                                <div style="display: flex; gap: 4px; flex-wrap: wrap; justify-content: flex-end;">
                                    ${webhooksForEvent.length > 0 
                                        ? webhooksForEvent.map(w => `<span style="background: #5865F2; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.7rem;">${sanitize(w.label)}</span>`).join('')
                                        : '<span style="color: var(--text-muted); font-size: 0.75rem;">Not configured</span>'
                                    }
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }
        
        // ==================== NOTIFICATION TRIGGERS ====================
        async function sendToWebhooks(eventType, embed, brand = 'all') {
            const webhooksToUse = discordWebhooks.filter(w => {
                if (!w[eventType]) return false;
                if (w.brand !== 'all' && brand !== 'all' && w.brand !== brand) return false;
                return true;
            });
            
            if (webhooksToUse.length === 0) {
                console.log(`No webhooks configured for ${eventType}`);
                return false;
            }
            
            let success = 0;
            for (const webhook of webhooksToUse) {
                try {
                    const response = await fetch(webhook.url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ embeds: [embed] })
                    });
                    if (response.ok) success++;
                } catch (err) {
                    console.error(`Error sending to ${webhook.label}:`, err);
                }
            }
            
            // Log the notification
            logNotification(eventType, embed.title, webhooksToUse.map(w => w.label));
            
            return success > 0;
        }
        
        function logNotification(eventType, title, channels) {
            notificationLog.unshift({
                timestamp: new Date().toISOString(),
                eventType,
                title,
                channels
            });
            
            // Keep only last 50
            if (notificationLog.length > 50) {
                notificationLog = notificationLog.slice(0, 50);
            }
            
            localStorage.setItem('notificationLog', JSON.stringify(notificationLog));
            renderNotificationLog();
        }
        
        function renderNotificationLog() {
            const container = document.getElementById('notificationLog');
            if (!container) return;
            
            if (notificationLog.length === 0) {
                container.innerHTML = '<div style="text-align: center; padding: 30px; color: var(--text-muted);">No notifications sent yet</div>';
                return;
            }
            
            container.innerHTML = notificationLog.map(n => {
                const time = new Date(n.timestamp).toLocaleString();
                const emoji = n.eventType === 'forWins' ? '🏆' : n.eventType === 'forAlerts' ? '🚨' : n.eventType === 'forReports' ? '📊' : '📝';
                
                return `
                    <div style="display: flex; gap: 10px; padding: 10px 12px; background: var(--bg-secondary); border-radius: 6px; font-size: 0.85rem;">
                        <span>${emoji}</span>
                        <div style="flex: 1; min-width: 0;">
                            <div style="font-weight: 500;">${sanitize(n.title || 'Notification')}</div>
                            <div style="font-size: 0.75rem; color: var(--text-muted);">→ ${n.channels.join(', ')}</div>
                        </div>
                        <div style="font-size: 0.7rem; color: var(--text-muted); white-space: nowrap;">${time}</div>
                    </div>
                `;
            }).join('');
        }
        
        function clearNotificationLog() {
            if (!confirm('Clear notification log?')) return;
            notificationLog = [];
            localStorage.setItem('notificationLog', JSON.stringify(notificationLog));
            renderNotificationLog();
            showToast('Log cleared', 'success');
        }
        
        async function triggerWinsNotification() {
            showToast('Generating wins notification...', 'info');
            
            // Get today's top performers from creator_performance
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const dateStr = yesterday.toISOString().split('T')[0];
            
            try {
                const { data, error } = await supabaseClient
                    .from('creator_performance')
                    .select('creator_name, brand, gmv')
                    .eq('report_date', dateStr)
                    .order('gmv', { ascending: false })
                    .limit(5);
                
                if (error) throw error;
                
                if (!data || data.length === 0) {
                    showToast('No performance data for yesterday', 'warning');
                    return;
                }
                
                const topCreators = data.filter(c => c.gmv > 0);
                if (topCreators.length === 0) {
                    showToast('No GMV recorded yesterday', 'warning');
                    return;
                }
                
                const fields = topCreators.slice(0, 3).map((c, i) => ({
                    name: `${['🥇', '🥈', '🥉'][i]} ${c.creator_name}`,
                    value: `$${Math.round(c.gmv).toLocaleString()} • ${BRAND_DISPLAY[c.brand] || c.brand}`,
                    inline: false
                }));
                
                const embed = {
                    title: '🏆 Daily Top Performers',
                    description: `Top creators for ${new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}`,
                    fields,
                    color: 16766720,
                    footer: { text: 'Creators Corner • Daily Wins' },
                    timestamp: new Date().toISOString()
                };
                
                const sent = await sendToWebhooks('forWins', embed);
                if (sent) {
                    showToast('Wins notification sent!', 'success');
                } else {
                    showToast('No webhooks configured for Wins', 'warning');
                }
                
            } catch (err) {
                console.error('Error triggering wins:', err);
                showToast('Error: ' + err.message, 'error');
            }
        }
        
        async function triggerAlertsNotification() {
            showToast('Checking for alerts...', 'info');
            
            // This would check for ghost creators, underperformers, etc.
            // For now, send a summary based on posting data
            try {
                // Get ghost creators (no posts in 5+ days) from managed_creators
                // This is a simplified version
                
                const embed = {
                    title: '🚨 Creator Alerts',
                    description: 'Daily alert summary',
                    fields: [
                        { name: '👻 Ghost Creators', value: 'Check Posting tab for details', inline: true },
                        { name: '⚠️ Attention Needed', value: 'Check Creators tab', inline: true }
                    ],
                    color: 16744576,
                    footer: { text: 'Creators Corner • Alerts' },
                    timestamp: new Date().toISOString()
                };
                
                const sent = await sendToWebhooks('forAlerts', embed);
                if (sent) {
                    showToast('Alerts notification sent!', 'success');
                } else {
                    showToast('No webhooks configured for Alerts', 'warning');
                }
                
            } catch (err) {
                console.error('Error triggering alerts:', err);
                showToast('Error: ' + err.message, 'error');
            }
        }
        
        async function triggerWeeklyReport() {
            showToast('Generating weekly report...', 'info');
            
            // Calculate last 7 days
            const endDate = new Date();
            endDate.setDate(endDate.getDate() - 1);
            const startDate = new Date(endDate);
            startDate.setDate(startDate.getDate() - 6);
            
            try {
                const { data, error } = await supabaseClient
                    .from('creator_performance')
                    .select('creator_name, brand, gmv')
                    .gte('report_date', startDate.toISOString().split('T')[0])
                    .lte('report_date', endDate.toISOString().split('T')[0]);
                
                if (error) throw error;
                
                // Aggregate
                const totals = { gmv: 0 };
                const byBrand = {};
                
                (data || []).forEach(row => {
                    totals.gmv += parseFloat(row.gmv) || 0;
                    if (!byBrand[row.brand]) byBrand[row.brand] = 0;
                    byBrand[row.brand] += parseFloat(row.gmv) || 0;
                });
                
                const brandFields = Object.entries(byBrand)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                    .map(([brand, gmv]) => ({
                        name: BRAND_DISPLAY[brand] || brand,
                        value: `$${Math.round(gmv).toLocaleString()}`,
                        inline: true
                    }));
                
                const embed = {
                    title: '📊 Weekly Performance Report',
                    description: `**${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}**\n\n💰 **Total GMV: $${Math.round(totals.gmv).toLocaleString()}**`,
                    fields: brandFields,
                    color: 5763719,
                    footer: { text: 'Creators Corner • Weekly Report' },
                    timestamp: new Date().toISOString()
                };
                
                const sent = await sendToWebhooks('forReports', embed);
                if (sent) {
                    showToast('Weekly report sent!', 'success');
                } else {
                    showToast('No webhooks configured for Reports', 'warning');
                }
                
            } catch (err) {
                console.error('Error triggering weekly report:', err);
                showToast('Error: ' + err.message, 'error');
            }
        }
        
        // ==================== WEEKLY REPORTS ====================
        async function generateWeeklyReport() {
            const period = document.getElementById('reportPeriod').value;
            const type = document.getElementById('reportType').value;
            const brand = document.getElementById('reportBrand').value;
            
            const includeGmv = document.getElementById('reportIncludeGmv').checked;
            const includeCreators = document.getElementById('reportIncludeCreators').checked;
            const includeVideos = document.getElementById('reportIncludeVideos').checked;
            const includeProducts = document.getElementById('reportIncludeProducts').checked;
            const includeTrends = document.getElementById('reportIncludeTrends').checked;
            
            showToast('Generating report...', 'info');
            
            // Calculate date range
            const now = new Date();
            let startDate, endDate;
            
            switch(period) {
                case 'last7':
                    endDate = new Date(now);
                    startDate = new Date(now);
                    startDate.setDate(startDate.getDate() - 7);
                    break;
                case 'lastWeek':
                    const lastMonday = new Date(now);
                    lastMonday.setDate(lastMonday.getDate() - lastMonday.getDay() - 6);
                    const lastSunday = new Date(lastMonday);
                    lastSunday.setDate(lastSunday.getDate() + 6);
                    startDate = lastMonday;
                    endDate = lastSunday;
                    break;
                case 'thisMonth':
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                    endDate = new Date(now);
                    break;
                case 'lastMonth':
                    startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                    endDate = new Date(now.getFullYear(), now.getMonth(), 0);
                    break;
            }
            
            const startStr = startDate.toISOString().split('T')[0];
            const endStr = endDate.toISOString().split('T')[0];
            
            try {
                // Fetch performance data
                let query = supabaseClient
                    .from('creator_performance')
                    .select('creator_name, brand, gmv, items_sold, video_views')
                    .gte('report_date', startStr)
                    .lte('report_date', endStr);
                
                if (brand !== 'all') {
                    query = query.eq('brand', brand);
                }
                
                const { data: perfData, error } = await query;
                if (error) throw error;
                
                // Aggregate data
                const totals = { gmv: 0, items: 0, views: 0 };
                const byBrand = {};
                const byCreator = {};
                
                perfData?.forEach(row => {
                    totals.gmv += parseFloat(row.gmv) || 0;
                    totals.items += parseInt(row.items_sold) || 0;
                    totals.views += parseInt(row.video_views) || 0;
                    
                    // By brand
                    if (!byBrand[row.brand]) {
                        byBrand[row.brand] = { gmv: 0, items: 0, views: 0 };
                    }
                    byBrand[row.brand].gmv += parseFloat(row.gmv) || 0;
                    byBrand[row.brand].items += parseInt(row.items_sold) || 0;
                    byBrand[row.brand].views += parseInt(row.video_views) || 0;
                    
                    // By creator
                    if (!byCreator[row.creator_name]) {
                        byCreator[row.creator_name] = { gmv: 0, items: 0, brand: row.brand };
                    }
                    byCreator[row.creator_name].gmv += parseFloat(row.gmv) || 0;
                    byCreator[row.creator_name].items += parseInt(row.items_sold) || 0;
                });
                
                // Sort creators by GMV
                const topCreators = Object.entries(byCreator)
                    .sort((a, b) => b[1].gmv - a[1].gmv)
                    .slice(0, 10);
                
                // Build report
                let report = `📊 WEEKLY PERFORMANCE REPORT\n`;
                report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
                report += `📅 Period: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}\n`;
                report += `🏷️ Brand: ${brand === 'all' ? 'All Brands' : BRAND_DISPLAY[brand] || brand}\n\n`;
                
                if (includeGmv) {
                    report += `💰 REVENUE SUMMARY\n`;
                    report += `───────────────────\n`;
                    report += `Total GMV:    ${fmtMoney(totals.gmv)}\n`;
                    report += `Items Sold:   ${fmtNum(totals.items)}\n`;
                    report += `Video Views:  ${fmtNum(totals.views)}\n\n`;
                    
                    if (brand === 'all') {
                        report += `📈 BY BRAND\n`;
                        report += `───────────────────\n`;
                        Object.entries(byBrand)
                            .sort((a, b) => b[1].gmv - a[1].gmv)
                            .forEach(([b, d]) => {
                                report += `${BRAND_DISPLAY[b] || b}: ${fmtMoney(d.gmv)}\n`;
                            });
                        report += `\n`;
                    }
                }
                
                if (includeCreators) {
                    report += `🏆 TOP CREATORS\n`;
                    report += `───────────────────\n`;
                    topCreators.forEach(([name, data], i) => {
                        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
                        report += `${medal} ${name}: ${fmtMoney(data.gmv)}\n`;
                    });
                    report += `\n`;
                }
                
                report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
                report += `Generated by Creators Corner Dashboard\n`;
                report += `${new Date().toLocaleString()}\n`;
                
                // Display report
                document.getElementById('reportPreview').style.display = 'block';
                document.getElementById('reportContent').textContent = report;
                
                showToast('Report generated!', 'success');
                
            } catch (err) {
                console.error('Error generating report:', err);
                showToast('Error generating report', 'error');
            }
        }
        
        function copyReportToClipboard() {
            const report = document.getElementById('reportContent').textContent;
            navigator.clipboard.writeText(report).then(() => {
                showToast('Report copied to clipboard!', 'success');
            });
        }
        
        // ==================== SHAREABLE REPORTS ====================
        let reportHistory = [];
        
        function initReportsTab() {
            reportHistory = JSON.parse(localStorage.getItem('reportHistory') || '[]');
            renderReportHistory();
            
            // Setup period change listener
            const periodSelect = document.getElementById('quickReportPeriod');
            if (periodSelect) {
                periodSelect.addEventListener('change', function() {
                    const customRange = document.getElementById('customDateRange');
                    if (customRange) {
                        customRange.style.display = this.value === 'custom' ? 'block' : 'none';
                    }
                });
            }
        }
        
        function getReportDateRange() {
            const period = document.getElementById('quickReportPeriod')?.value || 'last7';
            const now = new Date();
            let startDate, endDate;
            
            switch(period) {
                case 'last7':
                    endDate = new Date(now);
                    endDate.setDate(endDate.getDate() - 1);
                    startDate = new Date(endDate);
                    startDate.setDate(startDate.getDate() - 6);
                    break;
                case 'lastWeek':
                    // Find last Sunday
                    const lastSunday = new Date(now);
                    lastSunday.setDate(lastSunday.getDate() - lastSunday.getDay());
                    if (lastSunday >= now) lastSunday.setDate(lastSunday.getDate() - 7);
                    endDate = new Date(lastSunday);
                    startDate = new Date(lastSunday);
                    startDate.setDate(startDate.getDate() - 6);
                    break;
                case 'thisMonth':
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                    endDate = new Date(now);
                    endDate.setDate(endDate.getDate() - 1);
                    break;
                case 'lastMonth':
                    startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                    endDate = new Date(now.getFullYear(), now.getMonth(), 0);
                    break;
                case 'custom':
                    const startInput = document.getElementById('quickReportStart')?.value;
                    const endInput = document.getElementById('quickReportEnd')?.value;
                    if (startInput && endInput) {
                        startDate = new Date(startInput);
                        endDate = new Date(endInput);
                    } else {
                        endDate = new Date(now);
                        startDate = new Date(now);
                        startDate.setDate(startDate.getDate() - 7);
                    }
                    break;
                default:
                    endDate = new Date(now);
                    startDate = new Date(now);
                    startDate.setDate(startDate.getDate() - 7);
            }
            
            return {
                start: startDate.toISOString().split('T')[0],
                end: endDate.toISOString().split('T')[0]
            };
        }
        
        function openShareableReport(brand) {
            const { start, end } = getReportDateRange();
            const url = `report.html?brand=${brand}&start=${start}&end=${end}`;
            
            // Add to history
            const brandName = brand === 'all' ? 'All Brands' : (BRAND_DISPLAY[brand] || brand);
            const historyItem = {
                brand,
                brandName,
                start,
                end,
                url,
                createdAt: new Date().toISOString()
            };
            
            reportHistory.unshift(historyItem);
            if (reportHistory.length > 20) reportHistory = reportHistory.slice(0, 20);
            localStorage.setItem('reportHistory', JSON.stringify(reportHistory));
            renderReportHistory();
            
            // Open in new tab
            window.open(url, '_blank');
            showToast(`${brandName} report opened in new tab`, 'success');
        }
        
        function renderReportHistory() {
            const container = document.getElementById('recentReportsList');
            if (!container) return;
            
            if (reportHistory.length === 0) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 30px; color: var(--text-muted); background: var(--bg-secondary); border-radius: 8px;">
                        No reports generated yet. Click a brand above to create one.
                    </div>
                `;
                return;
            }
            
            container.innerHTML = `
                <div style="display: grid; gap: 8px;">
                    ${reportHistory.slice(0, 10).map(r => {
                        const dateRange = `${formatDateShort(r.start)} - ${formatDateShort(r.end)}`;
                        const createdTime = new Date(r.createdAt).toLocaleString();
                        return `
                            <div style="display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--bg-secondary); border-radius: 8px;">
                                <div style="flex: 1;">
                                    <div style="font-weight: 500;">${sanitize(r.brandName)}</div>
                                    <div style="font-size: 0.75rem; color: var(--text-muted);">${dateRange}</div>
                                </div>
                                <div style="font-size: 0.7rem; color: var(--text-muted);">${createdTime}</div>
                                <button class="btn btn-sm" onclick="window.open('${r.url}', '_blank')" style="padding: 6px 12px;">Open</button>
                                <button class="btn btn-sm" onclick="copyReportUrl('${r.url}')" style="padding: 6px 12px;">📋</button>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }
        
        function formatDateShort(dateStr) {
            return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
        
        function copyReportUrl(url) {
            const fullUrl = window.location.origin + '/' + url;
            navigator.clipboard.writeText(fullUrl).then(() => {
                showToast('Report link copied!', 'success');
            });
        }
        
        function clearReportHistory() {
            if (!confirm('Clear report history?')) return;
            reportHistory = [];
            localStorage.setItem('reportHistory', JSON.stringify(reportHistory));
            renderReportHistory();
            showToast('History cleared', 'success');
        }
        
        // Initialize reports tab when settings loads
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(initReportsTab, 500);
        });
        
        // ==================== LEGACY TEXT REPORTS ====================
        async function sendReportToDiscord() {
            // Use the new webhook system
            const webhooks = JSON.parse(localStorage.getItem('discordWebhooks') || '[]');
            const reportWebhooks = webhooks.filter(w => w.forReports);
            
            if (reportWebhooks.length === 0) {
                // Fall back to old single webhook
                const webhook = localStorage.getItem('discordWebhook');
                if (!webhook) {
                    showToast('No Discord webhooks configured for Reports', 'error');
                    return;
                }
                reportWebhooks.push({ url: webhook, label: 'Main' });
            }
            
            const report = document.getElementById('reportContent').textContent;
            
            let sent = 0;
            for (const webhook of reportWebhooks) {
                try {
                    const response = await fetch(webhook.url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            content: '```\n' + report.substring(0, 1900) + '\n```'
                        })
                    });
                    if (response.ok) sent++;
                } catch (err) {
                    console.error('Error sending to Discord:', err);
                }
            }
            
            if (sent > 0) {
                showToast(`Report sent to ${sent} Discord channel(s)!`, 'success');
            } else {
                showToast('Failed to send report', 'error');
            }
        }
        
        function saveReportSettings() {
            const settings = {
                autoSendDiscord: document.getElementById('autoSendDiscord').checked,
                autoSendEmail: document.getElementById('autoSendEmail').checked,
                scheduleWeekly: document.getElementById('scheduleWeekly').checked
            };
            localStorage.setItem('reportSettings', JSON.stringify(settings));
            showToast('Report settings saved', 'success');
        }
        
        function loadReportSettings() {
            const settings = JSON.parse(localStorage.getItem('reportSettings') || '{}');
            if (document.getElementById('autoSendDiscord')) {
                document.getElementById('autoSendDiscord').checked = settings.autoSendDiscord || false;
                document.getElementById('autoSendEmail').checked = settings.autoSendEmail || false;
                document.getElementById('scheduleWeekly').checked = settings.scheduleWeekly || false;
            }
        }
        
        function saveDiscordWebhook() {
            const webhook = document.getElementById('discordWebhook').value.trim();
            if (webhook && !webhook.startsWith('https://discord.com/api/webhooks/')) {
                showToast('Invalid webhook URL', 'error');
                return;
            }
            localStorage.setItem('discordWebhook', webhook);
            showToast('Webhook saved!', 'success');
            document.getElementById('discordStatus').innerHTML = webhook ? '<span style="color: var(--success);">✓ Webhook configured</span>' : '';
            updateIntegrationQuickStatus('discord', !!webhook);
        }
        
        async function testDiscordWebhook() {
            const webhook = localStorage.getItem('discordWebhook');
            if (!webhook) {
                showToast('Please save a webhook URL first', 'error');
                return;
            }
            
            const testMessage = {
                embeds: [{
                    title: '🧪 Test Connection',
                    description: 'Your Discord webhook is working! Creators Corner is connected.',
                    color: 16111923, // Yellow
                    footer: { text: 'Creators Corner Dashboard' },
                    timestamp: new Date().toISOString()
                }]
            };
            
            try {
                const response = await fetch(webhook, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(testMessage)
                });
                
                if (response.ok) {
                    showToast('Test message sent! Check your Discord.', 'success');
                } else {
                    showToast('Failed to send test message', 'error');
                }
            } catch (error) {
                showToast('Error connecting to Discord', 'error');
                console.error('Discord webhook error:', error);
            }
        }
        
        // Application Page Settings
        function saveApplicationSettings() {
            const settings = {
                welcomeVideoUrl: document.getElementById('welcomeVideoUrl').value.trim(),
                thankYouVideoUrl: document.getElementById('thankYouVideoUrl').value.trim(),
                discordClientId: document.getElementById('discordClientId').value.trim()
            };
            
            localStorage.setItem('applicationSettings', JSON.stringify(settings));
            showToast('Application settings saved!', 'success');
            
            const statusEl = document.getElementById('applicationSettingsStatus');
            statusEl.innerHTML = '<div style="color: var(--success); font-size: 0.9rem;">✓ Settings saved. Changes will appear on the application page.</div>';
        }
        
        function loadApplicationSettings() {
            const settings = JSON.parse(localStorage.getItem('applicationSettings') || '{}');
            
            if (document.getElementById('welcomeVideoUrl')) {
                document.getElementById('welcomeVideoUrl').value = settings.welcomeVideoUrl || '';
            }
            if (document.getElementById('thankYouVideoUrl')) {
                document.getElementById('thankYouVideoUrl').value = settings.thankYouVideoUrl || '';
            }
            if (document.getElementById('discordClientId')) {
                document.getElementById('discordClientId').value = settings.discordClientId || '';
            }
        }
        
        function previewApplicationPage() {
            window.open('apply.html', '_blank');
        }
        
        async function sendToDiscord(embed) {
            const webhook = localStorage.getItem('discordWebhook');
            if (!webhook) return false;
            
            try {
                const response = await fetch(webhook, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ embeds: [embed] })
                });
                return response.ok;
            } catch (error) {
                console.error('Discord send error:', error);
                return false;
            }
        }
        
        function sendWinToDiscord(creatorName, brand, gmv, reason) {
            const settings = JSON.parse(localStorage.getItem('discordNotifySettings') || '{}');
            if (settings.dailyWins === false) return;
            
            sendToDiscord({
                title: '🏆 Daily Win!',
                description: `**${creatorName}** (${BRAND_DISPLAY[brand] || brand})`,
                fields: [
                    { name: '💰 GMV', value: fmtMoney(gmv), inline: true },
                    { name: '🎖️ Achievement', value: reason, inline: true }
                ],
                color: 16766720, // Gold
                footer: { text: 'Creators Corner • Daily Ops' },
                timestamp: new Date().toISOString()
            });
        }
        
        function sendWeeklyWinnerToDiscord(creatorName, brand, gmv, rank) {
            const settings = JSON.parse(localStorage.getItem('discordNotifySettings') || '{}');
            if (settings.weeklyWinners === false) return;
            
            const medals = ['🥇', '🥈', '🥉'];
            sendToDiscord({
                title: `${medals[rank - 1] || '🏆'} Weekly Winner #${rank}`,
                description: `**${creatorName}** (${BRAND_DISPLAY[brand] || brand})`,
                fields: [
                    { name: '💰 Weekly GMV', value: fmtMoney(gmv), inline: true }
                ],
                color: rank === 1 ? 16766720 : rank === 2 ? 12632256 : 13467442,
                footer: { text: 'Creators Corner • Weekly Ops' },
                timestamp: new Date().toISOString()
            });
        }
        
        function sendAttentionToDiscord(creatorName, brand, issue) {
            const settings = JSON.parse(localStorage.getItem('discordNotifySettings') || '{}');
            if (settings.attention === false) return;
            
            sendToDiscord({
                title: '⚠️ Creator Attention Needed',
                description: `**${creatorName}** (${BRAND_DISPLAY[brand] || brand})`,
                fields: [
                    { name: '📋 Issue', value: issue, inline: false }
                ],
                color: 16744576, // Orange/Red
                footer: { text: 'Creators Corner • Alert' },
                timestamp: new Date().toISOString()
            });
        }

        // ==================== EMAIL/SMS INTEGRATION ====================
        function loadEmailSmsSettings() {
            const emailSettings = JSON.parse(localStorage.getItem('emailSettings') || '{}');
            const smsSettings = JSON.parse(localStorage.getItem('smsSettings') || '{}');
            const sheetsSettings = JSON.parse(localStorage.getItem('sheetsSettings') || '{}');
            const notifySettings = JSON.parse(localStorage.getItem('notifyChannels') || '{}');
            const webhook = localStorage.getItem('discordWebhook') || '';
            
            // Email
            document.getElementById('resendApiKey').value = emailSettings.apiKey || '';
            document.getElementById('resendFromEmail').value = emailSettings.fromEmail || '';
            if (emailSettings.apiKey) {
                document.getElementById('emailStatus').innerHTML = '<span style="color: var(--success);">✓ Email configured</span>';
            }
            
            // SMS
            document.getElementById('twilioSid').value = smsSettings.sid || '';
            document.getElementById('twilioToken').value = smsSettings.token || '';
            document.getElementById('twilioPhone').value = smsSettings.phone || '';
            if (smsSettings.sid) {
                document.getElementById('smsStatus').innerHTML = '<span style="color: var(--success);">✓ SMS configured</span>';
            }
            
            // Google Sheets
            document.getElementById('googleSheetId').value = sheetsSettings.sheetId || '';
            document.getElementById('googleServiceEmail').value = sheetsSettings.serviceEmail || '';
            if (sheetsSettings.sheetId) {
                document.getElementById('sheetsStatus').innerHTML = '<span style="color: var(--success);">✓ Sheets configured</span>';
            }
            
            // Channel preferences
            document.getElementById('emailDailyWins').checked = notifySettings.emailDailyWins || false;
            document.getElementById('smsDailyWins').checked = notifySettings.smsDailyWins || false;
            document.getElementById('emailWeeklySummary').checked = notifySettings.emailWeeklySummary !== false;
            document.getElementById('smsWeeklySummary').checked = notifySettings.smsWeeklySummary || false;
            document.getElementById('emailAttention').checked = notifySettings.emailAttention !== false;
            document.getElementById('smsAttention').checked = notifySettings.smsAttention !== false;
            document.getElementById('emailGoals').checked = notifySettings.emailGoals || false;
            document.getElementById('smsGoals').checked = notifySettings.smsGoals || false;
            document.getElementById('notifyGoals').checked = notifySettings.discordGoals || false;
            
            // Update quick status indicators
            updateIntegrationQuickStatus('discord', !!webhook);
            updateIntegrationQuickStatus('email', !!emailSettings.apiKey);
            updateIntegrationQuickStatus('sms', !!smsSettings.sid);
            updateIntegrationQuickStatus('sheets', !!sheetsSettings.sheetId);
            
            // Load subscribers
            loadSubscribers();
        }
        
        function updateIntegrationQuickStatus(type, isConnected) {
            const badgeEl = document.getElementById(`${type}StatusBadge`);
            
            if (badgeEl) {
                badgeEl.textContent = isConnected ? 'Connected' : 'Not connected';
                badgeEl.style.background = isConnected ? 'rgba(34, 197, 94, 0.2)' : 'var(--bg-secondary)';
                badgeEl.style.color = isConnected ? '#22c55e' : 'var(--text-muted)';
            }
        }
        
        function saveEmailSettings() {
            const apiKey = document.getElementById('resendApiKey').value.trim();
            const fromEmail = document.getElementById('resendFromEmail').value.trim();
            
            // Validation
            if (apiKey && !apiKey.startsWith('re_')) {
                showToast('Invalid Resend API key format (should start with "re_")', 'error');
                return;
            }
            
            if (fromEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromEmail)) {
                showToast('Invalid email address format', 'error');
                return;
            }
            
            const settings = { apiKey, fromEmail };
            localStorage.setItem('emailSettings', JSON.stringify(settings));
            showToast('Email settings saved!', 'success');
            document.getElementById('emailStatus').innerHTML = settings.apiKey ? '<span style="color: var(--success);">✓ Email configured</span>' : '';
            updateIntegrationQuickStatus('email', !!settings.apiKey);
        }
        
        function saveSmsSettings() {
            const sid = document.getElementById('twilioSid').value.trim();
            const token = document.getElementById('twilioToken').value.trim();
            const phone = document.getElementById('twilioPhone').value.trim();
            
            // Validation
            if (sid && !sid.startsWith('AC')) {
                showToast('Invalid Twilio SID format (should start with "AC")', 'error');
                return;
            }
            
            if (phone && !/^\+[1-9]\d{1,14}$/.test(phone)) {
                showToast('Invalid phone number format. Use E.164 format (e.g., +15551234567)', 'error');
                return;
            }
            
            const settings = { sid, token, phone };
            localStorage.setItem('smsSettings', JSON.stringify(settings));
            showToast('SMS settings saved!', 'success');
            document.getElementById('smsStatus').innerHTML = settings.sid ? '<span style="color: var(--success);">✓ SMS configured</span>' : '';
            updateIntegrationQuickStatus('sms', !!settings.sid);
        }
        
        function saveSheetsSettings() {
            const sheetId = document.getElementById('googleSheetId').value.trim();
            const serviceEmail = document.getElementById('googleServiceEmail').value.trim();
            
            // Basic validation
            if (sheetId && sheetId.length < 20) {
                showToast('Invalid Google Sheet ID (should be longer)', 'error');
                return;
            }
            
            if (serviceEmail && !serviceEmail.includes('@') && !serviceEmail.includes('.iam.gserviceaccount.com')) {
                showToast('Invalid service account email format', 'warning');
            }
            
            const settings = { sheetId, serviceEmail };
            localStorage.setItem('sheetsSettings', JSON.stringify(settings));
            showToast('Google Sheets settings saved!', 'success');
            document.getElementById('sheetsStatus').innerHTML = settings.sheetId ? '<span style="color: var(--success);">✓ Sheets configured</span>' : '';
            updateIntegrationQuickStatus('sheets', !!settings.sheetId);
        }
        
        function testSheetsConnection() {
            const sheetId = document.getElementById('googleSheetId').value.trim();
            
            if (!sheetId) {
                showToast('Please enter a Sheet ID first', 'warning');
                return;
            }
            
            // Open the sheet in a new tab to verify it exists
            const url = `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;
            window.open(url, '_blank');
            
            document.getElementById('sheetsStatus').innerHTML = '<span style="color: var(--accent);">📊 Opened sheet in new tab - verify access</span>';
            showToast('Sheet opened in new tab. Verify you have edit access.', 'info');
        }
        
        function saveNotificationSettings() {
            // Discord settings
            const discordSettings = {
                dailyWins: document.getElementById('notifyDailyWins').checked,
                weeklyWinners: document.getElementById('notifyWeeklyWinners').checked,
                attention: document.getElementById('notifyAttention').checked
            };
            localStorage.setItem('discordNotifySettings', JSON.stringify(discordSettings));
            
            // Channel preferences
            const channelSettings = {
                emailDailyWins: document.getElementById('emailDailyWins').checked,
                smsDailyWins: document.getElementById('smsDailyWins').checked,
                emailWeeklySummary: document.getElementById('emailWeeklySummary').checked,
                smsWeeklySummary: document.getElementById('smsWeeklySummary').checked,
                emailAttention: document.getElementById('emailAttention').checked,
                smsAttention: document.getElementById('smsAttention').checked,
                emailGoals: document.getElementById('emailGoals').checked,
                smsGoals: document.getElementById('smsGoals').checked,
                discordGoals: document.getElementById('notifyGoals').checked
            };
            localStorage.setItem('notifyChannels', JSON.stringify(channelSettings));
            
            showToast('Notification preferences saved!', 'success');
        }
        
        async function testEmailAlert() {
            const emailSettings = JSON.parse(localStorage.getItem('emailSettings') || '{}');
            if (!emailSettings.apiKey || !emailSettings.fromEmail) {
                showToast('Please save email settings first', 'error');
                return;
            }
            
            const testEmail = prompt('Enter your email address to receive test:');
            if (!testEmail) return;
            
            showToast('Sending test email...', 'info');
            
            // Note: In production, this would call your Supabase Edge Function
            // For now, we'll show how to call it
            try {
                const response = await fetch(`${SUPABASE_URL}/functions/v1/send-alert`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${SUPABASE_KEY}`
                    },
                    body: JSON.stringify({
                        type: 'email',
                        to: testEmail,
                        subject: '🧪 Test Email from Creators Corner',
                        html: `
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                                <h1 style="color: #f5c518;">✅ Email Connected!</h1>
                                <p>Your Creators Corner email alerts are working correctly.</p>
                                <p>You'll receive notifications about:</p>
                                <ul>
                                    <li>🏆 Daily Wins</li>
                                    <li>📊 Weekly Summaries</li>
                                    <li>⚠️ Attention Alerts</li>
                                </ul>
                                <hr style="border: 1px solid #eee;">
                                <p style="color: #666; font-size: 12px;">Creators Corner Dashboard</p>
                            </div>
                        `,
                        alertType: 'test'
                    })
                });
                
                if (response.ok) {
                    showToast('Test email sent! Check your inbox.', 'success');
                } else {
                    const error = await response.json();
                    showToast(error.error || 'Failed to send test email', 'error');
                }
            } catch (error) {
                console.error('Email test error:', error);
                showToast('Error: Edge function not deployed. See setup instructions.', 'error');
            }
        }
        
        async function testSmsAlert() {
            const smsSettings = JSON.parse(localStorage.getItem('smsSettings') || '{}');
            if (!smsSettings.sid || !smsSettings.token || !smsSettings.phone) {
                showToast('Please save SMS settings first', 'error');
                return;
            }
            
            const testPhone = prompt('Enter phone number to receive test (with country code, e.g. +1234567890):');
            if (!testPhone) return;
            
            showToast('Sending test SMS...', 'info');
            
            try {
                const response = await fetch(`${SUPABASE_URL}/functions/v1/send-alert`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${SUPABASE_KEY}`
                    },
                    body: JSON.stringify({
                        type: 'sms',
                        to: testPhone,
                        message: '✅ Creators Corner SMS alerts connected! You\'ll receive notifications for wins and alerts.',
                        alertType: 'test'
                    })
                });
                
                if (response.ok) {
                    showToast('Test SMS sent! Check your phone.', 'success');
                } else {
                    const error = await response.json();
                    showToast(error.error || 'Failed to send test SMS', 'error');
                }
            } catch (error) {
                console.error('SMS test error:', error);
                showToast('Error: Edge function not deployed. See setup instructions.', 'error');
            }
        }

        // ==================== SUBSCRIBER MANAGEMENT ====================
        async function loadSubscribers() {
            const { data, error } = await supabaseClient
                .from('alert_subscribers')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (error) {
                console.log('Subscribers table not found - run setup SQL first');
                document.getElementById('subscribersTable').innerHTML = `
                    <tr>
                        <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 20px;">
                            <p>Subscriber table not set up yet.</p>
                            <small>Run the <code>supabase_alerts_setup.sql</code> script in your Supabase SQL Editor.</small>
                        </td>
                    </tr>
                `;
                return;
            }
            
            if (!data || data.length === 0) {
                document.getElementById('subscribersTable').innerHTML = `
                    <tr>
                        <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 20px;">
                            No subscribers yet. Click "Add Subscriber" to get started.
                        </td>
                    </tr>
                `;
                return;
            }
            
            document.getElementById('subscribersTable').innerHTML = data.map(s => `
                <tr>
                    <td>${s.name}</td>
                    <td>${s.email || '-'}</td>
                    <td>${s.phone || '-'}</td>
                    <td>${s.brand ? BRAND_DISPLAY[s.brand] || s.brand : 'All'}</td>
                    <td>
                        <span class="badge ${s.is_active ? 'badge-managed' : 'badge-unmanaged'}">
                            ${s.is_active ? 'Active' : 'Inactive'}
                        </span>
                    </td>
                    <td>
                        <button class="btn" onclick="editSubscriber('${s.id}')" style="padding: 4px 8px; font-size: 0.8rem;">✏️</button>
                        <button class="btn" onclick="toggleSubscriber('${s.id}', ${!s.is_active})" style="padding: 4px 8px; font-size: 0.8rem;">
                            ${s.is_active ? '⏸️' : '▶️'}
                        </button>
                        <button class="btn" onclick="deleteSubscriber('${s.id}')" style="padding: 4px 8px; font-size: 0.8rem; color: var(--danger);">🗑️</button>
                    </td>
                </tr>
            `).join('');
        }
        
        function openAddSubscriberModal() {
            document.getElementById('subscriberModalTitle').textContent = 'Add Subscriber';
            document.getElementById('editSubscriberId').value = '';
            document.getElementById('subscriberName').value = '';
            document.getElementById('subscriberEmail').value = '';
            document.getElementById('subscriberPhone').value = '';
            document.getElementById('subscriberBrand').value = '';
            document.getElementById('subNotifyWins').checked = true;
            document.getElementById('subNotifyWeekly').checked = true;
            document.getElementById('subNotifyAttention').checked = true;
            document.getElementById('subNotifyGoals').checked = false;
            document.getElementById('subscriberModal').classList.add('show');
        }
        
        async function editSubscriber(id) {
            const { data } = await supabaseClient.from('alert_subscribers').select('*').eq('id', id).single();
            if (!data) return;
            
            document.getElementById('subscriberModalTitle').textContent = 'Edit Subscriber';
            document.getElementById('editSubscriberId').value = id;
            document.getElementById('subscriberName').value = data.name || '';
            document.getElementById('subscriberEmail').value = data.email || '';
            document.getElementById('subscriberPhone').value = data.phone || '';
            document.getElementById('subscriberBrand').value = data.brand || '';
            document.getElementById('subNotifyWins').checked = data.notify_daily_wins;
            document.getElementById('subNotifyWeekly').checked = data.notify_weekly_summary;
            document.getElementById('subNotifyAttention').checked = data.notify_attention_alerts;
            document.getElementById('subNotifyGoals').checked = data.notify_goal_progress;
            document.getElementById('subscriberModal').classList.add('show');
        }
        
        function closeSubscriberModal() {
            document.getElementById('subscriberModal').classList.remove('show');
        }
        
        async function saveSubscriber() {
            const id = document.getElementById('editSubscriberId').value;
            const name = document.getElementById('subscriberName').value.trim();
            const email = document.getElementById('subscriberEmail').value.trim();
            const phone = document.getElementById('subscriberPhone').value.trim();
            const brand = document.getElementById('subscriberBrand').value || null;
            
            if (!name) {
                showToast('Name is required', 'error');
                return;
            }
            
            if (!email && !phone) {
                showToast('Email or phone is required', 'error');
                return;
            }
            
            // Email validation
            if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                showToast('Invalid email address format', 'error');
                return;
            }
            
            // Phone validation (E.164 format)
            if (phone && !/^\+[1-9]\d{1,14}$/.test(phone)) {
                showToast('Invalid phone number. Use E.164 format (e.g., +15551234567)', 'error');
                return;
            }
            
            const subscriberData = {
                name,
                email: email || null,
                phone: phone || null,
                brand,
                notify_daily_wins: document.getElementById('subNotifyWins').checked,
                notify_weekly_summary: document.getElementById('subNotifyWeekly').checked,
                notify_attention_alerts: document.getElementById('subNotifyAttention').checked,
                notify_goal_progress: document.getElementById('subNotifyGoals').checked,
                updated_at: new Date().toISOString()
            };
            
            let error;
            if (id) {
                ({ error } = await supabaseClient.from('alert_subscribers').update(subscriberData).eq('id', id));
            } else {
                ({ error } = await supabaseClient.from('alert_subscribers').insert([subscriberData]));
            }
            
            if (error) {
                showToast('Error saving subscriber', 'error');
                console.error(error);
                return;
            }
            
            showToast('Subscriber saved!', 'success');
            closeSubscriberModal();
            loadSubscribers();
        }
        
        async function toggleSubscriber(id, isActive) {
            const { error } = await supabaseClient
                .from('alert_subscribers')
                .update({ is_active: isActive, updated_at: new Date().toISOString() })
                .eq('id', id);
            
            if (error) {
                showToast('Error updating subscriber', 'error');
                return;
            }
            
            showToast(isActive ? 'Subscriber activated' : 'Subscriber paused', 'success');
            loadSubscribers();
        }
        
        async function deleteSubscriber(id) {
            if (!confirm('Are you sure you want to delete this subscriber?')) return;
            
            const { error } = await supabaseClient.from('alert_subscribers').delete().eq('id', id);
            
            if (error) {
                showToast('Error deleting subscriber', 'error');
                return;
            }
            
            showToast('Subscriber deleted', 'success');
            loadSubscribers();
        }

