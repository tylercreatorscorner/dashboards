// ==================== OVERVIEW & BRANDS ====================
        // ==================== MORNING BRIEFING ====================
        function copyGhostList() {
            // Get ghosts from posting tab data
            const ghostGrid = document.getElementById('postingGhostsGrid');
            if (!ghostGrid) {
                showToast('Load Posting tab first', 'warning');
                return;
            }
            
            const ghostCards = ghostGrid.querySelectorAll('[data-creator-name]');
            if (ghostCards.length === 0) {
                showToast('No ghosts found', 'info');
                return;
            }
            
            let text = '👻 GHOST CREATORS - Need Outreach\n';
            text += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
            
            ghostCards.forEach(card => {
                const name = card.getAttribute('data-creator-name') || 'Unknown';
                const brand = card.getAttribute('data-brand') || '';
                const brandDisplay = BRAND_DISPLAY[brand] || brand;
                text += `• ${name} (${brandDisplay})\n`;
            });
            
            navigator.clipboard.writeText(text).then(() => {
                showToast('Ghost list copied!', 'success');
            });
        }

        // ==================== OVERVIEW ====================
        async function loadOverviewData() {
            showLoading('overview', 'Loading dashboard data...');
            try {
            const brand = document.getElementById('brandFilter').value;
            const startDate = document.getElementById('dateFilterStart').value;
            const endDate = document.getElementById('dateFilterEnd').value;
            const status = document.getElementById('statusFilter')?.value || 'all';
            const search = document.getElementById('searchInput')?.value?.toLowerCase() || '';

            if (!startDate || !endDate) { hideLoading('overview'); return; }

            let creators = [];
            
            // Try RPC first, fall back to direct query
            updateLoadingMessage('overview', 'Fetching creator data...');
            const { data: rpcData, error: rpcError } = await supabaseClient.rpc('get_creator_summary', {
                p_brand: brand === 'all' ? null : brand,
                p_start_date: startDate,
                p_end_date: endDate
            });
            
            // Check if RPC returned valid data with brand field
            if (!rpcError && rpcData && rpcData.length > 0 && rpcData[0].brand !== undefined) {
                creators = rpcData.map(row => ({
                    creator_name: row.creator_name,
                    brand: row.brand,
                    gmv: pFloat(row.total_gmv),
                    refunds: pFloat(row.total_refunds),
                    orders: pInt(row.total_orders),
                    items_sold: pInt(row.total_items_sold),
                    videos: pInt(row.total_videos),
                    live_streams: pInt(row.total_live_streams),
                    est_commission: pFloat(row.total_commission),
                    aov: pInt(row.total_orders) > 0 ? pFloat(row.total_gmv) / pInt(row.total_orders) : 0
                }));
            } else {
                // Fallback: direct query with pagination
                console.log('Using fallback query for overview (RPC missing brand field)');
                let allData = [];
                let page = 0;
                let hasMore = true;
                let hitLimit = false;
                
                while (hasMore && page < MAX_PAGES) {
                    let query = supabaseClient
                        .from('creator_performance')
                        .select('creator_name, brand, gmv, refunds, orders, items_sold, videos, live_streams, est_commission')
                        .eq('period_type', 'daily')
                        .gte('report_date', startDate)
                        .lte('report_date', endDate)
                        .range(page * QUERY_PAGE_SIZE, (page + 1) * QUERY_PAGE_SIZE - 1);
                    
                    if (brand !== 'all') query = query.eq('brand', brand);
                    
                    const { data, error } = await query;
                    if (error || !data || data.length === 0) {
                        hasMore = false;
                    } else {
                        allData = allData.concat(data);
                        hasMore = data.length === QUERY_PAGE_SIZE;
                        page++;
                    }
                }
                if (page >= MAX_PAGES) { hitLimit = true; showDataLimitWarning('Overview', allData.length); }
                
                // Aggregate by creator + brand
                const aggregated = {};
                allData.forEach(row => {
                    const key = `${row.creator_name}|${row.brand}`;
                    if (!aggregated[key]) {
                        aggregated[key] = {
                            creator_name: row.creator_name,
                            brand: row.brand,
                            gmv: 0, refunds: 0, orders: 0, items_sold: 0, videos: 0, live_streams: 0, est_commission: 0
                        };
                    }
                    aggregated[key].gmv += pFloat(row.gmv);
                    aggregated[key].refunds += pFloat(row.refunds);
                    aggregated[key].orders += pInt(row.orders);
                    aggregated[key].items_sold += pInt(row.items_sold);
                    aggregated[key].videos += pInt(row.videos);
                    aggregated[key].live_streams += pInt(row.live_streams);
                    aggregated[key].est_commission += pFloat(row.est_commission);
                });
                
                creators = Object.values(aggregated).map(c => ({
                    ...c,
                    aov: c.orders > 0 ? c.gmv / c.orders : 0
                }));
            }

            if (status === 'managed') creators = creators.filter(c => isManagedForBrand(c.creator_name, c.brand));
            if (status === 'unmanaged') creators = creators.filter(c => !isManagedForBrand(c.creator_name, c.brand));
            if (search) creators = creators.filter(c => c.creator_name.toLowerCase().includes(search));

            creators.sort((a, b) => (b.gmv || 0) - (a.gmv || 0));

            // Calculate stats
            const totalGmv = creators.reduce((s, c) => s + (c.gmv || 0), 0);
            const totalOrders = creators.reduce((s, c) => s + (c.orders || 0), 0);
            const totalVideos = creators.reduce((s, c) => s + (c.videos || 0), 0);
            const activeCreators = creators.filter(c => c.gmv > 0).length;
            const gmvPerVideo = totalVideos > 0 ? totalGmv / totalVideos : 0;
            const aov = totalOrders > 0 ? totalGmv / totalOrders : 0;

            // Managed vs Unmanaged
            const managed = creators.filter(c => isManagedForBrand(c.creator_name, c.brand));
            const unmanaged = creators.filter(c => !isManagedForBrand(c.creator_name, c.brand));
            const managedGmv = managed.reduce((s, c) => s + (c.gmv || 0), 0);
            const unmanagedGmv = unmanaged.reduce((s, c) => s + (c.gmv || 0), 0);

            // Update stats (values)
            const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
            setEl('statGmv', fmtMoney(totalGmv));
            setEl('statOrders', fmt(totalOrders));
            setEl('statCreators', fmt(activeCreators));
            setEl('statVideos', fmt(totalVideos));
            setEl('statGmvPerVideo', fmtMoney(gmvPerVideo));
            setEl('statAov', fmtMoney(aov));
            
            // Calculate prior period for trend comparison
            const start = new Date(startDate);
            const end = new Date(endDate);
            const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
            const priorEnd = new Date(start);
            priorEnd.setDate(priorEnd.getDate() - 1);
            const priorStart = new Date(priorEnd);
            priorStart.setDate(priorStart.getDate() - daysDiff + 1);
            const priorStartStr = priorStart.toISOString().split('T')[0];
            const priorEndStr = priorEnd.toISOString().split('T')[0];
            
            // Fetch prior period data for comparison
            updateLoadingMessage('overview', 'Calculating trends...');
            try {
                const { data: priorRpcData } = await supabaseClient.rpc('get_creator_summary', {
                    p_brand: brand === 'all' ? null : brand,
                    p_start_date: priorStartStr,
                    p_end_date: priorEndStr
                });
                
                let priorCreators = [];
                if (priorRpcData && priorRpcData.length > 0) {
                    priorCreators = priorRpcData.map(row => ({
                        creator_name: row.creator_name,
                        brand: row.brand,
                        gmv: pFloat(row.total_gmv),
                        orders: pInt(row.total_orders),
                        videos: pInt(row.total_videos)
                    }));
                    
                    // Apply same filters
                    if (status === 'managed') priorCreators = priorCreators.filter(c => isManagedForBrand(c.creator_name, c.brand));
                    if (status === 'unmanaged') priorCreators = priorCreators.filter(c => !isManagedForBrand(c.creator_name, c.brand));
                }
                
                // Calculate prior period totals
                const priorGmv = priorCreators.reduce((s, c) => s + (c.gmv || 0), 0);
                const priorOrders = priorCreators.reduce((s, c) => s + (c.orders || 0), 0);
                const priorVideos = priorCreators.reduce((s, c) => s + (c.videos || 0), 0);
                const priorActiveCreators = priorCreators.filter(c => c.gmv > 0).length;
                const priorGmvPerVideo = priorVideos > 0 ? priorGmv / priorVideos : 0;
                const priorAov = priorOrders > 0 ? priorGmv / priorOrders : 0;
                
                // Update trend indicators
                updateTrendIndicator('statGmvChange', totalGmv, priorGmv);
                updateTrendIndicator('statOrdersChange', totalOrders, priorOrders);
                updateTrendIndicator('statCreatorsChange', activeCreators, priorActiveCreators);
                updateTrendIndicator('statVideosChange', totalVideos, priorVideos);
                updateTrendIndicator('statGmvPerVideoChange', gmvPerVideo, priorGmvPerVideo);
                updateTrendIndicator('statAovChange', aov, priorAov);
                
            } catch (trendErr) {
                console.warn('Could not calculate trends:', trendErr);
                // Set all trends to neutral
                ['statGmvChange', 'statOrdersChange', 'statCreatorsChange', 'statVideosChange', 'statGmvPerVideoChange', 'statAovChange'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) { el.textContent = '--'; el.className = 'stat-change neutral'; }
                });
            }
            
            // Date range display
            const dateRangeText = startDate === endDate ? formatDate(startDate) : `${formatDate(startDate)} → ${formatDate(endDate)}`;
            setEl('dateRange', `${dateRangeText} • ${brand === 'all' ? 'All Brands' : BRAND_DISPLAY[brand]}`);

            // Managed vs Unmanaged comparison
            const managedActiveCount = managed.filter(c => c.gmv > 0).length;
            const unmanagedActiveCount = unmanaged.filter(c => c.gmv > 0).length;
            const managedAvgGmv = managedActiveCount > 0 ? managedGmv / managedActiveCount : 0;
            const unmanagedAvgGmv = unmanagedActiveCount > 0 ? unmanagedGmv / unmanagedActiveCount : 0;
            
            setEl('managedGmv', fmtMoney(managedGmv));
            setEl('managedCount', managedActiveCount);
            setEl('managedAvg', fmtMoney(managedAvgGmv));
            setEl('unmanagedGmv', fmtMoney(unmanagedGmv));
            setEl('unmanagedCount', unmanagedActiveCount);
            setEl('unmanagedAvg', fmtMoney(unmanagedAvgGmv));
            
            // Update progress bar and displays
            const combinedGmv = managedGmv + unmanagedGmv;
            const managedPct = combinedGmv > 0 ? (managedGmv / combinedGmv * 100) : 0;
            const unmanagedPct = combinedGmv > 0 ? (unmanagedGmv / combinedGmv * 100) : 0;
            
            const managedGmvDisplay = document.getElementById('managedGmvDisplay');
            const unmanagedGmvDisplay = document.getElementById('unmanagedGmvDisplay');
            const managedGmvBar = document.getElementById('managedGmvBar');
            const unmanagedGmvBar = document.getElementById('unmanagedGmvBar');
            const managedPctLabel = document.getElementById('managedPctLabel');
            
            if (managedGmvDisplay) managedGmvDisplay.textContent = fmtMoney(managedGmv);
            if (unmanagedGmvDisplay) unmanagedGmvDisplay.textContent = fmtMoney(unmanagedGmv);
            if (managedGmvBar) managedGmvBar.style.width = managedPct + '%';
            if (unmanagedGmvBar) unmanagedGmvBar.style.width = unmanagedPct + '%';
            if (managedPctLabel) managedPctLabel.textContent = managedPct.toFixed(1) + '%';

            // Store creators for pagination and render (removed table but keep for data)
            window.overviewCreators = creators;

            // Render Brand Donut Chart
            renderBrandDonutChart(creators);
            
            // Load and render GMV Trend Chart
            loadGmvTrendData(brand, startDate, endDate, status);
            
            // Load new Overview sections (pass brand filter)
            loadOverviewActionItems(brand);
            loadOverviewWins(brand);
            loadAgencyHealth(brand);
            } finally {
                hideLoading('overview');
                window.overviewLoadedOnce = true;
            }
        }
        
        // ==================== OVERVIEW HELPER FUNCTIONS ====================
        
        function toggleOverviewSection(section) {
            const content = document.getElementById(`overview${section.charAt(0).toUpperCase() + section.slice(1)}Content`);
            const toggle = document.getElementById(`overview${section.charAt(0).toUpperCase() + section.slice(1)}Toggle`);
            if (!content || !toggle) return;
            
            const isHidden = content.style.display === 'none';
            content.style.display = isHidden ? 'block' : 'none';
            toggle.textContent = isHidden ? '▼' : '▶';
        }
        
        async function loadOverviewActionItems(brand = 'all') {
            const listEl = document.getElementById('overviewActionsList');
            const countEl = document.getElementById('overviewActionsCount');
            if (!listEl) return;
            
            try {
                await loadManagedCreators();
                /**
                 * ACTION ITEMS CRITERIA:
                 * 1. Overdue Contracts (Priority 1): Contract start date + length < today
                 * 2. Low ROI Creators (Priority 2): ROI < 1x over rolling 30 days  
                 * 3. Ghost Creators (Priority 3): No posts in 7+ days (retainer creators only)
                 */
                
                const actions = [];
                const today = new Date();
                const thirtyDaysAgo = new Date(today);
                thirtyDaysAgo.setDate(today.getDate() - 29);
                const startStr = thirtyDaysAgo.toISOString().split('T')[0];
                const endStr = today.toISOString().split('T')[0];
                
                // Build handles map for retainer creators (filtered by brand)
                let retainerCreators = managedCreators.filter(c => c.status === 'Active' && hasAnyRetainer(c));
                if (brand !== 'all') {
                    retainerCreators = retainerCreators.filter(c => c.brand === brand);
                }
                const handleToCreator = {};
                retainerCreators.forEach(c => {
                    [c.account_1, c.account_2, c.account_3, c.account_4, c.account_5].forEach(a => {
                        if (a && a.trim()) handleToCreator[a.toLowerCase()] = c;
                    });
                });
                
                // Fetch 30-day performance for ROI and posting analysis (filtered by brand)
                let perfQuery = supabaseClient
                    .from('creator_performance')
                    .select('creator_name, gmv, videos, report_date, brand')
                    .gte('report_date', startStr)
                    .lte('report_date', endStr);
                if (brand !== 'all') {
                    perfQuery = perfQuery.eq('brand', brand);
                }
                const { data: perfData } = await perfQuery.limit(30000);
                
                // Aggregate by creator
                const creatorStats = {};
                (perfData || []).forEach(r => {
                    const handle = r.creator_name.toLowerCase();
                    if (!creatorStats[handle]) {
                        creatorStats[handle] = { gmv: 0, videos: 0, lastPostDate: null };
                    }
                    creatorStats[handle].gmv += pFloat(r.gmv);
                    creatorStats[handle].videos += pInt(r.videos);
                    if (pInt(r.videos) > 0 && (!creatorStats[handle].lastPostDate || r.report_date > creatorStats[handle].lastPostDate)) {
                        creatorStats[handle].lastPostDate = r.report_date;
                    }
                });
                
                // 1. Check for overdue contracts
                retainerCreators.forEach(c => {
                    if (c.retainer_start_date) {
                        const startDate = new Date(c.retainer_start_date);
                        const contractLength = c.contract_length_days || 30;
                        const daysSinceStart = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
                        
                        if (daysSinceStart > contractLength) {
                            const daysOver = daysSinceStart - contractLength;
                            actions.push({
                                type: 'overdue',
                                priority: 1,
                                icon: '⏰',
                                text: `${c.real_name || c.account_1} contract ${daysOver}d overdue`,
                                subtext: `${BRAND_DISPLAY[c.brand] || c.brand} • Reset or review`,
                                id: c.id
                            });
                        }
                    }
                });
                
                // 2. Check for low ROI creators (< 1x)
                retainerCreators.forEach(c => {
                    const retainer = getTotalRetainer(c);
                    if (retainer <= 0) return;
                    
                    let creatorGmv = 0;
                    [c.account_1, c.account_2, c.account_3, c.account_4, c.account_5].forEach(a => {
                        if (a && a.trim() && creatorStats[a.toLowerCase()]) {
                            creatorGmv += creatorStats[a.toLowerCase()].gmv;
                        }
                    });
                    
                    const roi = creatorGmv / retainer;
                    if (roi < 1) {
                        const loss = Math.round(retainer - creatorGmv);
                        actions.push({
                            type: 'roi',
                            priority: 2,
                            icon: '📉',
                            text: `${c.real_name || c.account_1} has ${roi.toFixed(1)}x ROI`,
                            subtext: `${BRAND_DISPLAY[c.brand] || c.brand} • Losing ~$${loss}/mo`,
                            id: c.id,
                            roi: roi // for sorting
                        });
                    }
                });
                
                // 3. Check for ghost creators (no posts in 7+ days)
                retainerCreators.forEach(c => {
                    let lastPost = null;
                    [c.account_1, c.account_2, c.account_3, c.account_4, c.account_5].forEach(a => {
                        if (a && a.trim() && creatorStats[a.toLowerCase()]?.lastPostDate) {
                            const postDate = creatorStats[a.toLowerCase()].lastPostDate;
                            if (!lastPost || postDate > lastPost) lastPost = postDate;
                        }
                    });
                    
                    if (lastPost) {
                        const daysSincePost = Math.floor((today - new Date(lastPost)) / (1000 * 60 * 60 * 24));
                        if (daysSincePost >= 7) {
                            actions.push({
                                type: 'ghost',
                                priority: 3,
                                icon: '👻',
                                text: `${c.real_name || c.account_1} hasn't posted in ${daysSincePost}d`,
                                subtext: `${BRAND_DISPLAY[c.brand] || c.brand}`,
                                id: c.id
                            });
                        }
                    }
                });
                
                // Sort by priority, then by severity within priority
                actions.sort((a, b) => {
                    if (a.priority !== b.priority) return a.priority - b.priority;
                    if (a.type === 'roi' && b.type === 'roi') return a.roi - b.roi; // Worst ROI first
                    return 0;
                });
                
                countEl.textContent = actions.length;
                
                if (actions.length === 0) {
                    listEl.innerHTML = `
                        <div style="text-align: center; padding: 20px; color: var(--text-muted);">
                            <div style="font-size: 1.5rem; margin-bottom: 8px;">✅</div>
                            <div>No urgent action items!</div>
                        </div>`;
                } else {
                    listEl.innerHTML = actions.slice(0, 8).map(a => `
                        <div style="display: flex; align-items: center; gap: 10px; padding: 10px; background: var(--bg-secondary); border-radius: 8px; cursor: pointer;" onclick="editCreator(${a.id})">
                            <span style="font-size: 1.1rem;">${a.icon}</span>
                            <div style="flex: 1; min-width: 0;">
                                <div style="font-weight: 500; font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${a.text}</div>
                                <div style="font-size: 0.7rem; color: var(--text-muted);">${a.subtext}</div>
                            </div>
                            <span style="color: var(--text-muted);">→</span>
                        </div>
                    `).join('');
                }
            } catch (err) {
                console.error('Error loading action items:', err);
                listEl.innerHTML = `<div style="color: var(--text-muted); text-align: center; padding: 20px;">Could not load action items</div>`;
            }
        }
        
        async function loadOverviewWins(brand = 'all') {
            /**
             * TODAY'S WINS CRITERIA:
             * - Yesterday's data only (most recent complete day)
             * - Managed creators only (matched by handle)
             * - GMV >= $100 threshold
             * - Sorted by GMV descending, top 10 shown
             */
            const listEl = document.getElementById('overviewWinsList');
            const countEl = document.getElementById('overviewWinsCount');
            if (!listEl) return;
            
            try {
                // Get yesterday's date for wins
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                const yesterdayStr = yesterday.toISOString().split('T')[0];
                
                await loadManagedCreators();
                
                // Build managed handles (filtered by brand if specified)
                const managedHandles = new Set();
                let filteredCreators = managedCreators;
                if (brand !== 'all') {
                    filteredCreators = managedCreators.filter(c => c.brand === brand);
                }
                filteredCreators.forEach(c => {
                    [c.account_1, c.account_2, c.account_3, c.account_4, c.account_5].forEach(a => {
                        if (a && a.trim()) managedHandles.add(a.toLowerCase());
                    });
                });
                
                // Fetch yesterday's top performers (filtered by brand)
                let query = supabaseClient
                    .from('creator_performance')
                    .select('creator_name, brand, gmv, orders, videos')
                    .eq('report_date', yesterdayStr);
                if (brand !== 'all') {
                    query = query.eq('brand', brand);
                }
                const { data, error } = await query
                    .order('gmv', { ascending: false })
                    .limit(100);
                
                if (error) throw error;
                
                const wins = (data || [])
                    .filter(r => managedHandles.has(r.creator_name.toLowerCase()) && pFloat(r.gmv) >= 100)
                    .slice(0, 10)
                    .map(r => ({
                        name: r.creator_name,
                        brand: r.brand,
                        gmv: pFloat(r.gmv),
                        orders: pInt(r.orders)
                    }));
                
                window.overviewWinsData = wins;
                countEl.textContent = wins.length;
                
                if (wins.length === 0) {
                    listEl.innerHTML = `
                        <div style="text-align: center; padding: 20px; color: var(--text-muted);">
                            <div style="font-size: 1.5rem; margin-bottom: 8px;">📊</div>
                            <div>No big wins yesterday</div>
                        </div>`;
                } else {
                    listEl.innerHTML = wins.map((w, i) => `
                        <div style="display: flex; align-items: center; gap: 10px; padding: 10px; background: var(--bg-secondary); border-radius: 8px;">
                            <span style="font-size: 1rem; width: 24px; text-align: center;">${i < 3 ? ['🥇', '🥈', '🥉'][i] : '🏆'}</span>
                            <div style="flex: 1; min-width: 0;">
                                <div style="font-weight: 500; font-size: 0.85rem;">@${w.name}</div>
                                <div style="font-size: 0.7rem; color: var(--text-muted);">${BRAND_DISPLAY[w.brand] || w.brand}</div>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-weight: 700; color: var(--success); font-size: 0.9rem;">${fmtMoney(w.gmv)}</div>
                                <div style="font-size: 0.65rem; color: var(--text-muted);">${w.orders} orders</div>
                            </div>
                        </div>
                    `).join('');
                }
            } catch (err) {
                console.error('Error loading wins:', err);
                listEl.innerHTML = `<div style="color: var(--text-muted); text-align: center; padding: 20px;">Could not load wins</div>`;
            }
        }
        
        function copyOverviewWins() {
            const wins = window.overviewWinsData || [];
            if (wins.length === 0) {
                showToast('No wins to copy', 'error');
                return;
            }
            
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const dateStr = yesterday.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
            
            let text = `🎉 **Yesterday's Wins** (${dateStr})\n\n`;
            wins.forEach((w, i) => {
                const medal = i < 3 ? ['🥇', '🥈', '🥉'][i] : '🏆';
                text += `${medal} **@${w.name}** - ${fmtMoney(w.gmv)} (${w.orders} orders)\n`;
            });
            
            navigator.clipboard.writeText(text).then(() => {
                showToast('Wins copied to clipboard!', 'success');
            });
        }
        
        async function loadAgencyHealth(brand = 'all') {
            try {
                await loadManagedCreators();
                
                // Calculate retainer spend (filtered by brand)
                let totalRetainer = 0;
                let retainerCount = 0;
                let retainerCreators = managedCreators.filter(c => c.status === 'Active' && hasAnyRetainer(c));
                if (brand !== 'all') {
                    retainerCreators = retainerCreators.filter(c => c.brand === brand);
                }
                
                retainerCreators.forEach(c => {
                    totalRetainer += getTotalRetainer(c);
                    retainerCount++;
                });
                
                // Get 30-day GMV for managed creators
                const today = new Date();
                const thirtyDaysAgo = new Date(today);
                thirtyDaysAgo.setDate(today.getDate() - 29);
                const startStr = thirtyDaysAgo.toISOString().split('T')[0];
                const endStr = today.toISOString().split('T')[0];
                
                // Build managed handles set (filtered by brand)
                const managedHandles = new Set();
                let filteredManagedCreators = managedCreators;
                if (brand !== 'all') {
                    filteredManagedCreators = managedCreators.filter(c => c.brand === brand);
                }
                filteredManagedCreators.forEach(c => {
                    [c.account_1, c.account_2, c.account_3, c.account_4, c.account_5].forEach(a => {
                        if (a && a.trim()) managedHandles.add(a.toLowerCase());
                    });
                });
                
                // Fetch 30-day performance (filtered by brand)
                let perfQuery = supabaseClient
                    .from('creator_performance')
                    .select('creator_name, gmv')
                    .gte('report_date', startStr)
                    .lte('report_date', endStr);
                if (brand !== 'all') {
                    perfQuery = perfQuery.eq('brand', brand);
                }
                const { data: perfData } = await perfQuery.limit(30000);
                
                let managedGmv = 0;
                let totalGmv = 0;
                (perfData || []).forEach(r => {
                    const gmv = pFloat(r.gmv);
                    totalGmv += gmv;
                    if (managedHandles.has(r.creator_name.toLowerCase())) {
                        managedGmv += gmv;
                    }
                });
                
                const portfolioRoi = totalRetainer > 0 ? managedGmv / totalRetainer : 0;
                const managedPct = totalGmv > 0 ? (managedGmv / totalGmv) * 100 : 0;
                const estCommission = managedGmv * 0.025;
                
                // Update UI
                document.getElementById('agencyRetainerSpend').textContent = fmtMoney(totalRetainer);
                document.getElementById('agencyRetainerCount').textContent = `${retainerCount} creators`;
                document.getElementById('agencyManagedGmv').textContent = fmtMoney(managedGmv);
                document.getElementById('agencyManagedPct').textContent = `${managedPct.toFixed(1)}% of total`;
                document.getElementById('agencyRoi').textContent = `${portfolioRoi.toFixed(1)}x`;
                document.getElementById('agencyRoi').style.color = portfolioRoi >= 3 ? '#22c55e' : portfolioRoi >= 1 ? '#f59e0b' : '#ef4444';
                document.getElementById('agencyCommission').textContent = fmtMoney(estCommission);
                
                // Calculate ROI distribution by computing each creator's ROI
                let cutCount = 0, watchCount = 0, keepCount = 0, starCount = 0;
                
                // Aggregate GMV by creator handle from performance data
                const creatorGmvMap = {};
                (perfData || []).forEach(r => {
                    const handle = r.creator_name.toLowerCase();
                    if (managedHandles.has(handle)) {
                        creatorGmvMap[handle] = (creatorGmvMap[handle] || 0) + pFloat(r.gmv);
                    }
                });
                
                // For each retainer creator, calculate ROI and categorize
                retainerCreators.forEach(c => {
                    const retainer = getTotalRetainer(c);
                    if (retainer <= 0) return;
                    
                    // Sum GMV across all accounts for this creator
                    let creatorGmv = 0;
                    [c.account_1, c.account_2, c.account_3, c.account_4, c.account_5].forEach(a => {
                        if (a && a.trim()) {
                            creatorGmv += creatorGmvMap[a.toLowerCase()] || 0;
                        }
                    });
                    
                    const roi = creatorGmv / retainer;
                    
                    // Categorize: Cut (<1x), Watch (1-3x), Keep (3-10x), Stars (10x+)
                    if (roi >= 10) starCount++;
                    else if (roi >= 3) keepCount++;
                    else if (roi >= 1) watchCount++;
                    else cutCount++;
                });
                
                const totalRoi = cutCount + watchCount + keepCount + starCount;
                if (totalRoi > 0) {
                    document.getElementById('roiBarCut').style.width = `${(cutCount / totalRoi) * 100}%`;
                    document.getElementById('roiBarWatch').style.width = `${(watchCount / totalRoi) * 100}%`;
                    document.getElementById('roiBarKeep').style.width = `${(keepCount / totalRoi) * 100}%`;
                    document.getElementById('roiBarStar').style.width = `${(starCount / totalRoi) * 100}%`;
                    
                    document.getElementById('roiCountCut').textContent = `(${cutCount})`;
                    document.getElementById('roiCountWatch').textContent = `(${watchCount})`;
                    document.getElementById('roiCountKeep').textContent = `(${keepCount})`;
                    document.getElementById('roiCountStar').textContent = `(${starCount})`;
                    document.getElementById('agencyRoiSummary').textContent = `${totalRoi} retainer creators`;
                }
                
            } catch (err) {
                console.error('Error loading agency health:', err);
            }
        }
        
        // Legacy Morning Brief - kept for compatibility
        let morningBriefData = { wins: [], urgent: [] };
        
        async function loadMorningBrief() {
            const dateEl = document.getElementById('morningBriefDate');
            const winsListEl = document.getElementById('morningWinsList');
            const urgentListEl = document.getElementById('morningUrgentList');
            const winsCountEl = document.getElementById('morningWinsCount');
            const urgentCountEl = document.getElementById('morningUrgentCount');
            
            // Get yesterday's date
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];
            
            dateEl.textContent = yesterday.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
            
            try {
                await loadManagedCreators();
                
                // Fetch yesterday's performance for managed creators
                const { data: perfData } = await supabaseClient
                    .from('creator_performance')
                    .select('creator_name, brand, gmv, orders, videos')
                    .eq('report_date', yesterdayStr);
                
                // Aggregate by creator
                const creatorMap = new Map();
                (perfData || []).forEach(row => {
                    const key = `${row.creator_name?.toLowerCase()}|||${row.brand}`;
                    const managed = isManagedForBrand(row.creator_name, row.brand);
                    if (!managed) return;
                    
                    if (!creatorMap.has(key)) {
                        creatorMap.set(key, {
                            creator_name: row.creator_name,
                            brand: row.brand,
                            gmv: 0,
                            orders: 0,
                            videos: 0
                        });
                    }
                    const c = creatorMap.get(key);
                    c.gmv += pFloat(row.gmv);
                    c.orders += pInt(row.orders);
                    c.videos += pInt(row.videos);
                });
                
                const creators = [...creatorMap.values()];
                
                // Wins: Creators with $100+ GMV yesterday
                const wins = creators.filter(c => c.gmv >= 100).sort((a, b) => b.gmv - a.gmv).slice(0, 5);
                
                // Urgent: Get creators who haven't posted in 5+ days
                const fiveDaysAgo = new Date();
                fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
                const fiveDaysStr = fiveDaysAgo.toISOString().split('T')[0];
                
                const { data: recentActivity } = await supabaseClient
                    .from('creator_performance')
                    .select('creator_name, brand, videos')
                    .gte('report_date', fiveDaysStr)
                    .gt('videos', 0);
                
                // Get unique active creators
                const activeCreators = new Set();
                (recentActivity || []).forEach(row => {
                    activeCreators.add(`${row.creator_name?.toLowerCase()}|||${row.brand}`);
                });
                
                // Find managed creators who aren't in active set
                const urgent = managedCreators
                    .filter(mc => !activeCreators.has(`${mc.account_1?.toLowerCase()}|||${mc.brand}`))
                    .slice(0, 5)
                    .map(mc => ({
                        creator_name: mc.account_1 || mc.discord_name,
                        brand: mc.brand,
                        reason: 'No posts in 5+ days'
                    }));
                
                morningBriefData = { wins, urgent };
                
                // Render wins
                winsCountEl.textContent = wins.length;
                if (wins.length === 0) {
                    winsListEl.innerHTML = '<div style="color: var(--text-muted); font-size: 0.85rem; padding: 8px 0;">No big wins yesterday — keep pushing! 💪</div>';
                } else {
                    winsListEl.innerHTML = wins.map(w => `
                        <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border-light);">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="font-size: 1rem;">${BRAND_ICONS[w.brand] || '🏷️'}</span>
                                <span style="font-weight: 500; cursor: pointer;" onclick="openCreatorDetail('${w.creator_name}', '${w.brand}')">@${w.creator_name}</span>
                            </div>
                            <span style="font-weight: 600; color: var(--success);">${fmtMoney(w.gmv)}</span>
                        </div>
                    `).join('');
                }
                
                // Render urgent
                urgentCountEl.textContent = urgent.length;
                if (urgent.length === 0) {
                    urgentListEl.innerHTML = '<div style="color: var(--text-muted); font-size: 0.85rem; padding: 8px 0;">All creators active — great! ✅</div>';
                } else {
                    urgentListEl.innerHTML = urgent.map(u => `
                        <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border-light);">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="font-size: 1rem;">${BRAND_ICONS[u.brand] || '🏷️'}</span>
                                <span style="font-weight: 500; cursor: pointer;" onclick="openCreatorDetail('${u.creator_name}', '${u.brand}')">@${u.creator_name}</span>
                            </div>
                            <span style="font-size: 0.75rem; color: var(--error);">${u.reason}</span>
                        </div>
                    `).join('');
                }
            } catch (err) {
                console.error('Failed to load morning brief:', err);
                winsListEl.innerHTML = '<div style="color: var(--error); font-size: 0.85rem;">Failed to load</div>';
                urgentListEl.innerHTML = '<div style="color: var(--error); font-size: 0.85rem;">Failed to load</div>';
            }
        }
        
        function copyMorningWins() {
            const wins = morningBriefData.wins || [];
            if (wins.length === 0) {
                showToast('No wins to copy', 'info');
                return;
            }
            
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const dateStr = yesterday.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
            
            let text = `🏆 **Wins for ${dateStr}**\n\n`;
            wins.forEach(w => {
                text += `${BRAND_ICONS[w.brand] || '🏷️'} **@${w.creator_name}** hit **${fmtMoney(w.gmv)}** GMV!\n`;
            });
            
            navigator.clipboard.writeText(text).then(() => {
                showToast('Wins copied to clipboard!', 'success');
            }).catch(() => {
                showToast('Failed to copy', 'error');
            });
        }
        
        function renderOverviewTable() {
            const creators = window.overviewCreators || [];
            const page = window.overviewPage || 1;
            const pageSize = window.overviewPageSize || 50;
            const totalPages = Math.ceil(creators.length / pageSize) || 1;
            
            const start = (page - 1) * pageSize;
            const end = Math.min(start + pageSize, creators.length);
            const pageCreators = creators.slice(start, end);
            
            // Render table
            document.getElementById('creatorsBody').innerHTML = pageCreators.map((c, i) => {
                const rank = start + i + 1;
                const tier = getTier(c.gmv || 0);
                const managed = isManagedForBrand(c.creator_name, c.brand);
                const info = getManagedInfo(c.creator_name);
                const gmvPerVid = c.videos > 0 ? (c.gmv || 0) / c.videos : 0;
                return `<tr class="clickable" onclick="openCreatorDetail('${c.creator_name}', '${c.brand}')">
                    <td style="text-align: center; font-weight: 600; color: ${rank <= 3 ? 'var(--accent)' : 'var(--text-muted)'};">${rank}</td>
                    <td><div class="creator-cell">
                        <div class="creator-avatar">${c.creator_name.charAt(0).toUpperCase()}</div>
                        <div class="creator-info">
                            <span class="creator-name">${c.creator_name}</span>
                            ${info ? `<span class="creator-handle">${info.real_name || ''}</span>` : ''}
                        </div>
                    </div></td>
                    <td><span class="badge-brand">${BRAND_DISPLAY[c.brand] || c.brand}</span></td>
                    <td><span class="gmv-value ${c.gmv >= 5000 ? 'gmv-high' : c.gmv >= 1000 ? 'gmv-medium' : 'gmv-low'}">${fmtMoney(c.gmv)}</span></td>
                    <td>${fmt(c.orders)}</td>
                    <td>${c.videos || 0}</td>
                    <td>${fmtMoney(gmvPerVid)}</td>
                    <td><span class="badge-tier ${tier.class}">${tier.name}</span></td>
                    <td><span class="badge ${managed ? 'badge-managed' : 'badge-unmanaged'}">${managed ? '✓' : '−'}</span></td>
                </tr>`;
            }).join('') || '<tr><td colspan="9"><div class="empty-state"><h3>No data</h3></div></td></tr>';

            // Update creator count
            const countEl = document.getElementById('creatorCount');
            if (countEl) countEl.textContent = `${creators.length} creators`;
            
            // Update pagination UI
            document.getElementById('overviewShowingStart').textContent = creators.length ? start + 1 : 0;
            document.getElementById('overviewShowingEnd').textContent = end;
            document.getElementById('overviewTotalCreators').textContent = creators.length;
            document.getElementById('overviewCurrentPage').textContent = page;
            document.getElementById('overviewTotalPages').textContent = totalPages;
            document.getElementById('overviewPrevBtn').disabled = page <= 1;
            document.getElementById('overviewNextBtn').disabled = page >= totalPages;
        }
        
        function overviewChangePage(delta) {
            const creators = window.overviewCreators || [];
            const pageSize = window.overviewPageSize || 50;
            const totalPages = Math.ceil(creators.length / pageSize) || 1;
            
            window.overviewPage = Math.max(1, Math.min(totalPages, (window.overviewPage || 1) + delta));
            renderOverviewTable();
            
            // Scroll to top of table
            document.querySelector('#view-overview .card:last-child')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        
        // Filter overview table by search input (client-side for currently loaded data)
        function filterOverviewTable() {
            const search = document.getElementById('searchInput')?.value?.toLowerCase() || '';
            const allCreators = window.overviewCreatorsUnfiltered || window.overviewCreators || [];
            
            // Store unfiltered on first filter
            if (!window.overviewCreatorsUnfiltered && window.overviewCreators) {
                window.overviewCreatorsUnfiltered = [...window.overviewCreators];
            }
            
            if (!search) {
                window.overviewCreators = window.overviewCreatorsUnfiltered || [];
            } else {
                window.overviewCreators = allCreators.filter(c => 
                    c.creator_name?.toLowerCase().includes(search) ||
                    (getManagedInfo(c.creator_name)?.real_name || '').toLowerCase().includes(search)
                );
            }
            
            window.overviewPage = 1;
            renderOverviewTable();
        }
        
        // Export overview table to CSV
        function exportOverviewToCSV() {
            const creators = window.overviewCreators || [];
            if (creators.length === 0) {
                showToast('No data to export', 'warning');
                return;
            }
            
            const headers = ['Rank', 'Creator', 'Real Name', 'Brand', 'GMV', 'Orders', 'Videos', 'GMV/Video', 'Tier', 'Managed'];
            const rows = creators.map((c, i) => {
                const tier = getTier(c.gmv || 0);
                const managed = isManagedForBrand(c.creator_name, c.brand);
                const info = getManagedInfo(c.creator_name);
                const gmvPerVid = c.videos > 0 ? (c.gmv || 0) / c.videos : 0;
                return [
                    i + 1,
                    c.creator_name,
                    info?.real_name || '',
                    BRAND_DISPLAY[c.brand] || c.brand,
                    (c.gmv || 0).toFixed(2),
                    c.orders || 0,
                    c.videos || 0,
                    gmvPerVid.toFixed(2),
                    tier.name,
                    managed ? 'Yes' : 'No'
                ];
            });
            
            const csvContent = [headers, ...rows]
                .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
                .join('\n');
            
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            const dateStr = new Date().toISOString().split('T')[0];
            link.href = url;
            link.download = `creator-performance-${dateStr}.csv`;
            link.click();
            URL.revokeObjectURL(url);
            
            showToast(`Exported ${creators.length} creators to CSV`, 'success');
        }

        // Chart instances
        let brandDonutChartInstance = null;
        let gmvTrendChartInstance = null;

        function renderBrandDonutChart(creators) {
            // Aggregate GMV by brand
            const brandGmv = {};
            creators.forEach(c => {
                const brandName = BRAND_DISPLAY[c.brand] || c.brand;
                brandGmv[brandName] = (brandGmv[brandName] || 0) + (c.gmv || 0);
            });
            
            const labels = Object.keys(brandGmv);
            const data = Object.values(brandGmv);
            const colors = ['#f5c518', '#3b82f6', '#10b981', '#8b5cf6', '#f97316'];
            
            const ctx = document.getElementById('brandDonutChart');
            if (!ctx) return;
            
            if (brandDonutChartInstance) {
                brandDonutChartInstance.destroy();
            }
            
            brandDonutChartInstance = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [{
                        data: data,
                        backgroundColor: colors.slice(0, labels.length),
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: {
                                color: '#9aa5b8',
                                padding: 12,
                                usePointStyle: true
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const value = context.raw;
                                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                    const pct = ((value / total) * 100).toFixed(1);
                                    return `${context.label}: ${fmtMoney(value)} (${pct}%)`;
                                }
                            }
                        },
                        datalabels: {
                            color: '#fff',
                            font: {
                                weight: 'bold',
                                size: 11
                            },
                            formatter: function(value, context) {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const pct = ((value / total) * 100);
                                // Only show label if segment is large enough
                                return pct >= 5 ? pct.toFixed(0) + '%' : '';
                            },
                            anchor: 'center',
                            align: 'center'
                        }
                    },
                    cutout: '55%'
                },
                plugins: [ChartDataLabels]
            });
        }

        async function loadGmvTrendData(brand, startDate, endDate, status) {
            console.log('loadGmvTrendData called:', { brand, startDate, endDate, status });
            
            // If filtering by managed status, use fallback (client-side filtering)
            // since RPC doesn't support managed/unmanaged filtering
            if (status === 'managed' || status === 'unmanaged') {
                console.log('Using fallback for status filter:', status);
                await loadGmvTrendDataFallback(brand, startDate, endDate, status);
                return;
            }
            
            // Fetch daily GMV data for the trend chart - use aggregated query
            try {
                // Use RPC to get aggregated daily totals to avoid row limits
                const { data, error } = await supabaseClient.rpc('get_daily_gmv_trend', {
                    p_brand: brand === 'all' ? null : brand,
                    p_start_date: startDate,
                    p_end_date: endDate
                });
                
                if (error) {
                    console.error('Error loading trend data:', error);
                    // Fallback to direct query with limit
                    await loadGmvTrendDataFallback(brand, startDate, endDate, status);
                    return;
                }
                
                // Data already aggregated by date from RPC - field is trend_date
                const sortedData = (data || []).sort((a, b) => {
                    const dateA = a.trend_date || a.report_date || '';
                    const dateB = b.trend_date || b.report_date || '';
                    return dateA.localeCompare(dateB);
                });
                const labels = sortedData.map(d => {
                    const dateStr = d.trend_date || d.report_date;
                    const date = new Date(dateStr + 'T00:00:00');
                    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                });
                const values = sortedData.map(d => parseFloat(d.total_gmv) || 0);
                
                console.log('RPC returned', sortedData.length, 'days of data');
                renderGmvTrendChart(labels, values);
            } catch (err) {
                console.error('Trend data error:', err);
                await loadGmvTrendDataFallback(brand, startDate, endDate, status);
            }
        }
        
        async function loadGmvTrendDataFallback(brand, startDate, endDate, status) {
            console.log('loadGmvTrendDataFallback called:', { brand, startDate, endDate, status });
            try {
                // Fetch ALL data using pagination (Supabase default limit is 1000)
                let allData = [];
                let page = 0;
                const pageSize = QUERY_PAGE_SIZE;
                let hasMore = true;
                
                while (hasMore) {
                    let query = supabaseClient
                        .from('creator_performance')
                        .select('report_date, gmv, creator_name, brand')
                        .eq('period_type', 'daily')
                        .gte('report_date', startDate)
                        .lte('report_date', endDate)
                        .range(page * pageSize, (page + 1) * pageSize - 1);
                    
                    if (brand !== 'all') {
                        query = query.eq('brand', brand);
                    }
                    
                    const { data, error } = await query;
                    
                    if (error) {
                        console.error('Error loading trend data page:', error);
                        break;
                    }
                    
                    if (data && data.length > 0) {
                        allData = allData.concat(data);
                        console.log(`Fetched page ${page + 1}: ${data.length} rows (total: ${allData.length})`);
                        hasMore = data.length === pageSize;
                        page++;
                    } else {
                        hasMore = false;
                    }
                    
                    // Safety limit
                    if (page >= MAX_PAGES) {
                        console.log('Hit pagination safety limit');
                        showDataLimitWarning('GMV Trend', allData.length);
                        break;
                    }
                }
                
                console.log('Total rows fetched:', allData.length);
                
                // Filter by managed status if needed
                let filteredData = allData;
                console.log('Before filtering:', filteredData.length, 'rows');
                
                if (status === 'managed') {
                    filteredData = filteredData.filter(d => isManagedForBrand(d.creator_name, d.brand));
                } else if (status === 'unmanaged') {
                    filteredData = filteredData.filter(d => !isManagedForBrand(d.creator_name, d.brand));
                }
                
                console.log('After filtering:', filteredData.length, 'rows');
                
                // Aggregate by date
                const dailyGmv = {};
                filteredData.forEach(row => {
                    const date = row.report_date;
                    dailyGmv[date] = (dailyGmv[date] || 0) + pFloat(row.gmv);
                });
                
                // Sort by date and prepare chart data
                const sortedDates = Object.keys(dailyGmv).sort();
                const labels = sortedDates.map(d => {
                    const date = new Date(d + 'T00:00:00');
                    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                });
                const values = sortedDates.map(d => dailyGmv[d]);
                
                console.log('Rendering chart with', labels.length, 'data points');
                renderGmvTrendChart(labels, values);
            } catch (err) {
                console.error('GMV trend fallback error:', err);
                renderGmvTrendChart([], []);
            }
        }

        function renderGmvTrendChart(labels, data) {
            const ctx = document.getElementById('gmvTrendChart');
            if (!ctx) return;
            
            if (gmvTrendChartInstance) {
                gmvTrendChartInstance.destroy();
                gmvTrendChartInstance = null;
            }
            
            // Handle empty data
            if (!labels || !data || labels.length === 0) {
                // Show empty state
                gmvTrendChartInstance = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: ['No Data'],
                        datasets: [{
                            label: 'GMV',
                            data: [0],
                            borderColor: '#f5c518',
                            backgroundColor: 'rgba(245, 197, 24, 0.1)',
                            fill: true
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } }
                    }
                });
                return;
            }
            
            gmvTrendChartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'GMV',
                        data: data,
                        borderColor: '#f5c518',
                        backgroundColor: 'rgba(245, 197, 24, 0.1)',
                        fill: true,
                        tension: 0.3,
                        pointRadius: 3,
                        pointBackgroundColor: '#f5c518'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return fmtMoney(context.raw);
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: {
                                color: 'rgba(255,255,255,0.05)'
                            },
                            ticks: {
                                color: '#9aa5b8',
                                maxRotation: 45
                            }
                        },
                        y: {
                            beginAtZero: true,
                            grace: '15%',
                            grid: {
                                color: 'rgba(255,255,255,0.05)'
                            },
                            ticks: {
                                color: '#9aa5b8',
                                callback: function(value) {
                                    return '$' + (value >= 1000 ? (value/1000).toFixed(0) + 'K' : value);
                                }
                            }
                        }
                    }
                }
            });
        }

        // Apply date preset selection (for overview - now handled by Litepicker ranges)
        function applyDatePreset(presetIndex) {
            if (presetIndex === '' || presetIndex === null) return;
            
            const preset = DATE_PRESETS[parseInt(presetIndex)];
            if (!preset) return;
            
            const dates = preset.getDates();
            
            // Update Litepicker instance
            if (datePickers['overview']) {
                datePickers['overview'].setDateRange(dates.start, dates.end);
            }
            
            // Update hidden input values
            document.getElementById('dateFilterStart').value = dates.start;
            document.getElementById('dateFilterEnd').value = dates.end;
            
            // Reload data
            loadOverviewData();
            updateLastUpdated();
        }

        // Apply date preset to specific section (Products, Videos, Creators, Brands)
        function applyDatePresetToSection(section, presetIndex) {
            if (presetIndex === '' || presetIndex === null) return;
            
            const preset = DATE_PRESETS[parseInt(presetIndex)];
            if (!preset) return;
            
            const dates = preset.getDates();
            
            // Map section to element IDs
            const sectionMap = {
                'products': { start: 'productsDateFilterStart', end: 'productsDateFilterEnd', load: loadProductsData },
                'videos': { start: 'videosDateFilterStart', end: 'videosDateFilterEnd', load: () => { pages.videos = 1; loadVideosData(); } },
                'creators': { start: 'creatorsDateFilterStart', end: 'creatorsDateFilterEnd', load: () => { pages.creators = 1; loadCreatorsData(); } },
                'brands': { start: 'brandsDateFilterStart', end: 'brandsDateFilterEnd', load: loadBrandsData }
            };
            
            const config = sectionMap[section];
            if (!config) return;
            
            // Update Litepicker instances
            const startEl = document.getElementById(config.start);
            const endEl = document.getElementById(config.end);
            
            if (datePickers[config.start]) {
                datePickers[config.start].setDate(dates.start);
            }
            if (datePickers[config.end]) {
                datePickers[config.end].setDate(dates.end);
            }
            
            // Update input values
            startEl.value = dates.start;
            endEl.value = dates.end;
            
            // Reload data for the section
            config.load();
            updateLastUpdated();
        }

        // Event listeners for overview - search only (brand and status have onchange in HTML)
        const searchInputEl = document.getElementById('searchInput');
        if (searchInputEl) searchInputEl.addEventListener('input', loadOverviewData);

        // ==================== BRANDS ====================
        let brandTrendChartInstance = null;
        
        async function loadBrandsData() {
            showLoading('brands', 'Loading brand data...');
            try {
            const startDate = document.getElementById('brandsDateFilterStart').value;
            const endDate = document.getElementById('brandsDateFilterEnd').value;
            const status = document.getElementById('brandsStatusFilter').value;
            if (!startDate || !endDate) { hideLoading('brands'); return; }

            // Calculate prior period for WoW comparison
            const start = new Date(startDate + 'T00:00:00');
            const end = new Date(endDate + 'T00:00:00');
            const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
            const priorEnd = new Date(start);
            priorEnd.setDate(priorEnd.getDate() - 1);
            const priorStart = new Date(priorEnd);
            priorStart.setDate(priorStart.getDate() - daysDiff + 1);

            // Fetch current period data with pagination
            let allData = [];
            let page = 0;
            const pageSize = QUERY_PAGE_SIZE;
            let hasMore = true;
            
            while (hasMore) {
                const { data, error } = await supabaseClient.from('creator_performance')
                    .select('*')
                    .gte('report_date', startDate)
                    .lte('report_date', endDate)
                    .eq('period_type', 'daily')
                    .range(page * pageSize, (page + 1) * pageSize - 1);
                
                if (error || !data || data.length === 0) {
                    hasMore = false;
                } else {
                    allData = allData.concat(data);
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
                    .gte('report_date', localDateStr(priorStart))
                    .lte('report_date', localDateStr(priorEnd))
                    .eq('period_type', 'daily')
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

            // Filter by managed status
            let filteredData = allData;
            let filteredPrior = priorData;
            if (status === 'managed') {
                filteredData = filteredData.filter(d => isManagedForBrand(d.creator_name, d.brand));
                filteredPrior = filteredPrior.filter(d => isManagedForBrand(d.creator_name, d.brand));
            } else if (status === 'unmanaged') {
                filteredData = filteredData.filter(d => !isManagedForBrand(d.creator_name, d.brand));
                filteredPrior = filteredPrior.filter(d => !isManagedForBrand(d.creator_name, d.brand));
            }

            // Group by brand and aggregate - current period
            const brands = {};
            const brandOrder = ['catakor', 'jiyu', 'physicians_choice', 'peach_slices', 'yerba_magic', 'toplux'];
            brandOrder.forEach(b => {
                brands[b] = { gmv: 0, orders: 0, videos: 0, commission: 0, creators: new Set() };
            });
            
            filteredData.forEach(c => {
                if (!brands[c.brand]) brands[c.brand] = { gmv: 0, orders: 0, videos: 0, commission: 0, creators: new Set() };
                const b = brands[c.brand];
                b.gmv += pFloat(c.gmv);
                b.orders += pInt(c.orders);
                b.videos += pInt(c.videos);
                b.commission += pFloat(c.est_commission);
                if (pFloat(c.gmv) > 0) b.creators.add(c.creator_name);
            });

            // Group by brand - prior period
            const priorBrands = {};
            filteredPrior.forEach(c => {
                if (!priorBrands[c.brand]) priorBrands[c.brand] = { gmv: 0 };
                priorBrands[c.brand].gmv += pFloat(c.gmv);
            });

            // Find top performer
            const sortedByGmv = Object.entries(brands).sort((a, b) => b[1].gmv - a[1].gmv);
            const topBrand = sortedByGmv[0]?.[0];

            // Render comparison cards
            document.getElementById('brandComparisonCards').innerHTML = brandOrder.map(brand => {
                const stats = brands[brand] || { gmv: 0, orders: 0, videos: 0, creators: new Set() };
                const priorGmv = priorBrands[brand]?.gmv || 0;
                const change = priorGmv > 0 ? ((stats.gmv - priorGmv) / priorGmv * 100) : (stats.gmv > 0 ? 100 : 0);
                const isTop = brand === topBrand;
                const active = stats.creators.size;
                
                return `<div class="brand-comparison-card ${isTop ? 'top-performer' : ''}">
                    <div class="brand-title">${isTop ? '👑 ' : ''}${BRAND_DISPLAY[brand] || brand}</div>
                    <div class="brand-gmv">${fmtMoney(stats.gmv)}</div>
                    <div class="brand-change ${change >= 0 ? 'trend-up' : 'trend-down'}">
                        ${change >= 0 ? '↑' : '↓'} ${Math.abs(change).toFixed(1)}% vs prior
                    </div>
                    <div class="brand-mini-stats">
                        <span>${fmt(stats.orders)} orders</span>
                        <span>${active} creators</span>
                    </div>
                </div>`;
            }).join('');

            // Render WoW table with all stats
            document.getElementById('brandWowBody').innerHTML = sortedByGmv.map(([brand, stats]) => {
                const priorGmv = priorBrands[brand]?.gmv || 0;
                const change = priorGmv > 0 ? ((stats.gmv - priorGmv) / priorGmv * 100) : (stats.gmv > 0 ? 100 : 0);
                const creatorCount = stats.creators?.size || 0;
                return `<tr>
                    <td><strong>${BRAND_DISPLAY[brand] || brand}</strong></td>
                    <td style="text-align: right;"><span class="gmv-value">${fmtMoney(stats.gmv)}</span></td>
                    <td style="text-align: right; color: var(--text-muted);">${fmtMoney(priorGmv)}</td>
                    <td style="text-align: right;"><span class="trend-indicator ${change >= 0 ? 'trend-up' : 'trend-down'}">
                        ${change >= 0 ? '↑' : '↓'} ${Math.abs(change).toFixed(1)}%
                    </span></td>
                    <td style="text-align: right;">${fmt(stats.orders)}</td>
                    <td style="text-align: right;">${creatorCount}</td>
                </tr>`;
            }).join('');

            // Load deep dive for selected brand
            loadBrandDeepDive();
            loadBrandTrendChart(currentTrendPeriod);
            } finally {
                hideLoading('brands');
            }
        }

        // Brand GMV Trend Chart - multi-week analysis
        let currentTrendPeriod = '7d';
        
        async function loadBrandTrendChart(period = '7d') {
            currentTrendPeriod = period;
            
            // Update button states
            ['7d', '4w', '8w', '3m'].forEach(p => {
                const btn = document.getElementById(`trendPeriod${p}`);
                if (btn) btn.classList.toggle('active', p === period);
            });
            
            const ctx = document.getElementById('brandTrendChart');
            if (!ctx) return;
            
            // Get selected KPI
            const kpi = document.getElementById('trendKpiSelect')?.value || 'gmv';
            
            // Calculate date range based on period
            const endDate = new Date();
            endDate.setDate(endDate.getDate() - 1); // Yesterday
            const startDate = new Date(endDate);
            
            let groupBy = 'day'; // day or week
            
            switch (period) {
                case '7d':
                    startDate.setDate(startDate.getDate() - 6);
                    groupBy = 'day';
                    break;
                case '4w':
                    startDate.setDate(startDate.getDate() - 27);
                    groupBy = 'week';
                    break;
                case '8w':
                    startDate.setDate(startDate.getDate() - 55);
                    groupBy = 'week';
                    break;
                case '3m':
                    startDate.setDate(startDate.getDate() - 89);
                    groupBy = 'week';
                    break;
            }
            
            const startStr = startDate.toISOString().split('T')[0];
            const endStr = endDate.toISOString().split('T')[0];
            
            try {
                // Fetch data per brand to avoid timeout on large queries
                const brandOrder = ['physicians_choice', 'jiyu', 'catakor', 'peach_slices', 'yerba_magic', 'toplux'];
                const brandData = {};
                const periodDates = {};
                const allPeriods = new Set();
                
                for (const brand of brandOrder) {
                    let brandRows = [];
                    let page = 0;
                    const pageSize = 10000; // Smaller page size for stability
                    let hasMore = true;
                    
                    while (hasMore && page < 5) { // Max 5 pages per brand
                        try {
                            const { data, error } = await supabaseClient.from('creator_performance')
                                .select('report_date, gmv, orders, videos, creator_name')
                                .eq('brand', brand)
                                .gte('report_date', startStr)
                                .lte('report_date', endStr)
                                .eq('period_type', 'daily')
                                .range(page * pageSize, (page + 1) * pageSize - 1);
                            
                            if (error) {
                                console.warn(`Error fetching ${brand} trend data:`, error);
                                hasMore = false;
                            } else if (!data || data.length === 0) {
                                hasMore = false;
                            } else {
                                brandRows = brandRows.concat(data);
                                hasMore = data.length === pageSize;
                                page++;
                            }
                        } catch (fetchErr) {
                            console.warn(`Fetch error for ${brand}:`, fetchErr);
                            hasMore = false;
                        }
                    }
                    
                    // Process this brand's data
                    brandRows.forEach(row => {
                        let periodKey;
                        let periodEndDate;
                        
                        if (groupBy === 'day') {
                            periodKey = row.report_date;
                            periodEndDate = row.report_date;
                        } else {
                            const d = new Date(row.report_date + 'T00:00:00');
                            const dayOfWeek = d.getDay();
                            const weekStart = new Date(d);
                            weekStart.setDate(d.getDate() - dayOfWeek);
                            const weekEnd = new Date(weekStart);
                            weekEnd.setDate(weekStart.getDate() + 6);
                            periodKey = weekStart.toISOString().split('T')[0];
                            periodEndDate = weekEnd.toISOString().split('T')[0];
                        }
                        
                        allPeriods.add(periodKey);
                        periodDates[periodKey] = periodEndDate;
                        
                        if (!brandData[brand]) brandData[brand] = {};
                        if (!brandData[brand][periodKey]) {
                            brandData[brand][periodKey] = { gmv: 0, orders: 0, videos: 0, creators: new Set() };
                        }
                        
                        brandData[brand][periodKey].gmv += parseFloat(row.gmv) || 0;
                        brandData[brand][periodKey].orders += parseInt(row.orders) || 0;
                        brandData[brand][periodKey].videos += parseInt(row.videos) || 0;
                        if (row.creator_name) brandData[brand][periodKey].creators.add(row.creator_name);
                    });
                }
                
                if (allPeriods.size === 0) {
                    console.warn('No trend data found for period:', period);
                    return;
                }
                
                // Sort periods chronologically
                const sortedPeriods = [...allPeriods].sort();
                
                // Format labels - show date ranges for weeks
                const labels = sortedPeriods.map(p => {
                    const startD = new Date(p + 'T00:00:00');
                    if (groupBy === 'day') {
                        return startD.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    } else {
                        const endD = new Date(periodDates[p] + 'T00:00:00');
                        const startMonth = startD.toLocaleDateString('en-US', { month: 'short' });
                        const endMonth = endD.toLocaleDateString('en-US', { month: 'short' });
                        if (startMonth === endMonth) {
                            return `${startMonth} ${startD.getDate()}-${endD.getDate()}`;
                        } else {
                            return `${startMonth} ${startD.getDate()} - ${endMonth} ${endD.getDate()}`;
                        }
                    }
                });
                
                // Build datasets based on selected KPI
                const brandColors = {
                    'catakor': { line: '#e74c3c', bg: 'rgba(231, 76, 60, 0.1)' },
                    'jiyu': { line: '#9b59b6', bg: 'rgba(155, 89, 182, 0.1)' },
                    'physicians_choice': { line: '#3498db', bg: 'rgba(52, 152, 219, 0.1)' },
                    'peach_slices': { line: '#ff6b9d', bg: 'rgba(255, 107, 157, 0.1)' },
                    'yerba_magic': { line: '#2ecc71', bg: 'rgba(46, 204, 113, 0.1)' },
                    'toplux': { line: '#00b894', bg: 'rgba(0, 184, 148, 0.1)' }
                };
                
                const datasets = brandOrder
                    .filter(brand => brandData[brand])
                    .map(brand => {
                        const colors = brandColors[brand] || { line: '#888', bg: 'rgba(136,136,136,0.1)' };
                        
                        // Get data based on KPI
                        const getData = (periodData) => {
                            if (!periodData) return 0;
                            switch (kpi) {
                                case 'gmv': return periodData.gmv || 0;
                                case 'orders': return periodData.orders || 0;
                                case 'videos': return periodData.videos || 0;
                                case 'creators': return periodData.creators?.size || 0;
                                default: return periodData.gmv || 0;
                            }
                        };
                        
                        return {
                            label: BRAND_DISPLAY[brand] || brand,
                            data: sortedPeriods.map(p => getData(brandData[brand][p])),
                            borderColor: colors.line,
                            backgroundColor: colors.bg,
                            fill: true,
                            tension: 0.3,
                            pointRadius: groupBy === 'day' ? 4 : 5,
                            pointHoverRadius: 6,
                            borderWidth: 2
                        };
                    });
                
                // Destroy existing chart
                if (brandTrendChartInstance) {
                    brandTrendChartInstance.destroy();
                }
                
                // Tooltip and Y-axis formatting based on KPI
                const kpiConfig = {
                    gmv: { 
                        format: (v) => fmtMoney(v),
                        yAxisFormat: (v) => '$' + (v >= 1000 ? (v/1000).toFixed(0) + 'K' : v)
                    },
                    orders: { 
                        format: (v) => v.toLocaleString() + ' orders',
                        yAxisFormat: (v) => v >= 1000 ? (v/1000).toFixed(0) + 'K' : v
                    },
                    videos: { 
                        format: (v) => v.toLocaleString() + ' videos',
                        yAxisFormat: (v) => v >= 1000 ? (v/1000).toFixed(0) + 'K' : v
                    },
                    creators: { 
                        format: (v) => v.toLocaleString() + ' creators',
                        yAxisFormat: (v) => v
                    }
                };
                
                const config = kpiConfig[kpi] || kpiConfig.gmv;
                
                // Create chart
                brandTrendChartInstance = new Chart(ctx, {
                    type: 'line',
                    data: { labels, datasets },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        interaction: {
                            mode: 'index',
                            intersect: false
                        },
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                callbacks: {
                                    label: (ctx) => `${ctx.dataset.label}: ${config.format(ctx.raw)}`
                                }
                            }
                        },
                        scales: {
                            x: {
                                grid: { display: false },
                                ticks: { 
                                    color: '#9aa5b8',
                                    maxRotation: 45,
                                    minRotation: 0
                                }
                            },
                            y: {
                                grid: { color: 'rgba(255,255,255,0.05)' },
                                ticks: {
                                    color: '#9aa5b8',
                                    callback: config.yAxisFormat
                                }
                            }
                        }
                    }
                });
                
                // Render custom legend
                const legendEl = document.getElementById('brandTrendLegend');
                if (legendEl) {
                    legendEl.innerHTML = datasets.map(ds => `
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <div style="width: 12px; height: 12px; border-radius: 50%; background: ${ds.borderColor};"></div>
                            <span style="font-size: 0.85rem; color: var(--text-secondary);">${ds.label}</span>
                        </div>
                    `).join('');
                }
                
            } catch (err) {
                console.error('Error loading brand trend chart:', err);
            }
        }
        
        function getWeekNumber(d) {
            const onejan = new Date(d.getFullYear(), 0, 1);
            const week = Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
            return week;
        }

        async function loadBrandDeepDive() {
            const brand = document.getElementById('brandDeepDiveSelect').value;
            const startDate = document.getElementById('brandsDateFilterStart').value;
            const endDate = document.getElementById('brandsDateFilterEnd').value;
            const status = document.getElementById('brandsStatusFilter').value;
            
            if (!startDate || !endDate || !brand) return;

            // Calculate prior period
            const start = new Date(startDate + 'T00:00:00');
            const end = new Date(endDate + 'T00:00:00');
            const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
            const priorEnd = new Date(start);
            priorEnd.setDate(priorEnd.getDate() - 1);
            const priorStart = new Date(priorEnd);
            priorStart.setDate(priorStart.getDate() - daysDiff + 1);

            // Fetch current period data for this brand with pagination
            let allData = [];
            let page = 0;
            const pageSize = QUERY_PAGE_SIZE;
            let hasMore = true;
            
            while (hasMore) {
                const { data, error } = await supabaseClient.from('creator_performance')
                    .select('*')
                    .eq('brand', brand)
                    .gte('report_date', startDate)
                    .lte('report_date', endDate)
                    .eq('period_type', 'daily')
                    .range(page * pageSize, (page + 1) * pageSize - 1);
                
                if (error || !data || data.length === 0) {
                    hasMore = false;
                } else {
                    allData = allData.concat(data);
                    hasMore = data.length === pageSize;
                    page++;
                }
                if (page >= MAX_PAGES) break;
            }

            // Fetch prior period
            let priorData = [];
            page = 0;
            hasMore = true;
            
            while (hasMore) {
                const { data, error } = await supabaseClient.from('creator_performance')
                    .select('*')
                    .eq('brand', brand)
                    .gte('report_date', localDateStr(priorStart))
                    .lte('report_date', localDateStr(priorEnd))
                    .eq('period_type', 'daily')
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

            // Filter by status if needed (but calculate managed breakdown from all data first)
            const managedData = allData.filter(d => isManagedForBrand(d.creator_name, d.brand));
            const unmanagedData = allData.filter(d => !isManagedForBrand(d.creator_name, d.brand));
            
            let filteredData = allData;
            let filteredPrior = priorData;
            if (status === 'managed') {
                filteredData = managedData;
                filteredPrior = priorData.filter(d => isManagedForBrand(d.creator_name, d.brand));
            } else if (status === 'unmanaged') {
                filteredData = unmanagedData;
                filteredPrior = priorData.filter(d => !isManagedForBrand(d.creator_name, d.brand));
            }

            // Calculate totals
            const totals = {
                gmv: filteredData.reduce((s, d) => s + pFloat(d.gmv), 0),
                orders: filteredData.reduce((s, d) => s + pInt(d.orders), 0),
                videos: filteredData.reduce((s, d) => s + pInt(d.videos), 0),
                commission: filteredData.reduce((s, d) => s + pFloat(d.est_commission), 0),
                creators: new Set(filteredData.filter(d => pFloat(d.gmv) > 0).map(d => d.creator_name)).size
            };
            
            // Calculate prior period totals
            const priorTotals = {
                gmv: filteredPrior.reduce((s, d) => s + pFloat(d.gmv), 0),
                orders: filteredPrior.reduce((s, d) => s + pInt(d.orders), 0),
                videos: filteredPrior.reduce((s, d) => s + pInt(d.videos), 0),
                commission: filteredPrior.reduce((s, d) => s + pFloat(d.est_commission), 0),
                creators: new Set(filteredPrior.filter(d => pFloat(d.gmv) > 0).map(d => d.creator_name)).size
            };
            
            const aov = totals.orders > 0 ? totals.gmv / totals.orders : 0;
            const priorAov = priorTotals.orders > 0 ? priorTotals.gmv / priorTotals.orders : 0;

            // Update stats with trends
            document.getElementById('ddGmv').textContent = fmtMoney(totals.gmv);
            updateTrendIndicator('ddGmvChange', totals.gmv, priorTotals.gmv);
            
            document.getElementById('ddOrders').textContent = fmt(totals.orders);
            updateTrendIndicator('ddOrdersChange', totals.orders, priorTotals.orders);
            
            document.getElementById('ddCreators').textContent = totals.creators;
            updateTrendIndicator('ddCreatorsChange', totals.creators, priorTotals.creators);
            
            document.getElementById('ddVideos').textContent = fmt(totals.videos);
            updateTrendIndicator('ddVideosChange', totals.videos, priorTotals.videos);
            
            document.getElementById('ddAov').textContent = fmtMoney(aov);
            updateTrendIndicator('ddAovChange', aov, priorAov);
            
            document.getElementById('ddCommission').textContent = fmtMoney(totals.commission);
            updateTrendIndicator('ddCommissionChange', totals.commission, priorTotals.commission);

            // Managed vs Unmanaged breakdown (always show full breakdown)
            const managedGmv = managedData.reduce((s, d) => s + pFloat(d.gmv), 0);
            const unmanagedGmv = unmanagedData.reduce((s, d) => s + pFloat(d.gmv), 0);
            const managedCreators = new Set(managedData.filter(d => pFloat(d.gmv) > 0).map(d => d.creator_name)).size;
            const unmanagedCreators = new Set(unmanagedData.filter(d => pFloat(d.gmv) > 0).map(d => d.creator_name)).size;
            
            document.getElementById('ddManagedGmv').textContent = fmtMoney(managedGmv);
            document.getElementById('ddManagedCount').textContent = `${managedCreators} creators`;
            document.getElementById('ddManagedAvg').textContent = `${fmtMoney(managedCreators > 0 ? managedGmv / managedCreators : 0)} avg`;
            document.getElementById('ddUnmanagedGmv').textContent = fmtMoney(unmanagedGmv);
            document.getElementById('ddUnmanagedCount').textContent = `${unmanagedCreators} creators`;
            document.getElementById('ddUnmanagedAvg').textContent = `${fmtMoney(unmanagedCreators > 0 ? unmanagedGmv / unmanagedCreators : 0)} avg`;

            // Aggregate by creator and get top 10
            const creatorMap = new Map();
            filteredData.forEach(row => {
                if (!creatorMap.has(row.creator_name)) {
                    creatorMap.set(row.creator_name, {
                        creator_name: row.creator_name,
                        gmv: 0, orders: 0, videos: 0, commission: 0
                    });
                }
                const c = creatorMap.get(row.creator_name);
                c.gmv += pFloat(row.gmv);
                c.orders += pInt(row.orders);
                c.videos += pInt(row.videos);
                c.commission += pFloat(row.est_commission);
            });
            
            const topCreators = [...creatorMap.values()]
                .sort((a, b) => b.gmv - a.gmv)
                .slice(0, 10);

            document.getElementById('brandTopCreatorsBody').innerHTML = topCreators.map((c, i) => {
                const managed = isManagedForBrand(c.creator_name, brand);
                const aov = c.orders > 0 ? c.gmv / c.orders : 0;
                return `<tr>
                    <td style="text-align: center; font-weight: 600; color: ${i < 3 ? 'var(--accent)' : 'var(--text-muted)'};">${i + 1}</td>
                    <td><div class="creator-cell">
                        <div class="creator-avatar">${c.creator_name.charAt(0).toUpperCase()}</div>
                        <span class="creator-name">${c.creator_name}</span>
                    </div></td>
                    <td><span class="badge ${managed ? 'badge-managed' : 'badge-unmanaged'}">${managed ? '✓ Managed' : 'Unmanaged'}</span></td>
                    <td><span class="gmv-value gmv-high">${fmtMoney(c.gmv)}</span></td>
                    <td>${fmt(c.orders)}</td>
                    <td>${c.videos}</td>
                    <td>${fmtMoney(aov)}</td>
                    <td>${fmtMoney(c.commission)}</td>
                </tr>`;
            }).join('') || '<tr><td colspan="8"><div class="empty-state">No creators found</div></td></tr>';
            
            // Load product breakdown
            loadProductBreakdown(brand, startDate, endDate, totals.gmv);
        }
        
        // Product breakdown cache for drilldown
        let productBreakdownCache = {};
        
        async function loadProductBreakdown(brand, startDate, endDate, totalBrandGmv) {
            const tbody = document.getElementById('brandProductsBody');
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px;"><div class="spinner"></div> Loading products...</td></tr>';
            
            try {
                // Try product_performance first, then fall back to video_performance
                let allProductData = [];
                let page = 0;
                const pageSize = QUERY_PAGE_SIZE;
                let hasMore = true;
                let useVideoPerformance = false;
                
                // Try product_performance table first
                while (hasMore) {
                    const { data, error } = await supabaseClient
                        .from('product_performance')
                        .select('product_name, product_id, gmv, orders, creator_name, report_date')
                        .eq('brand', brand)
                        .gte('report_date', startDate)
                        .lte('report_date', endDate)
                        .range(page * pageSize, (page + 1) * pageSize - 1);
                    
                    if (error) {
                        console.log('product_performance not available, trying video_performance');
                        useVideoPerformance = true;
                        hasMore = false;
                    } else if (!data || data.length === 0) {
                        hasMore = false;
                    } else {
                        allProductData = allProductData.concat(data);
                        hasMore = data.length === pageSize;
                        page++;
                    }
                    if (page >= MAX_PAGES) break;
                }
                
                // Fallback to video_performance if product_performance is empty
                if (allProductData.length === 0 || useVideoPerformance) {
                    console.log('Using video_performance for product breakdown');
                    allProductData = [];
                    page = 0;
                    hasMore = true;
                    
                    while (hasMore) {
                        const { data, error } = await supabaseClient
                            .from('video_performance')
                            .select('product_name, gmv, orders, creator_name, report_date')
                            .eq('brand', brand)
                            .gte('report_date', startDate)
                            .lte('report_date', endDate)
                            .not('product_name', 'is', null)
                            .range(page * pageSize, (page + 1) * pageSize - 1);
                        
                        if (error) {
                            console.error('Video performance fetch error:', error);
                            hasMore = false;
                        } else if (!data || data.length === 0) {
                            hasMore = false;
                        } else {
                            allProductData = allProductData.concat(data);
                            hasMore = data.length === pageSize;
                            page++;
                        }
                        if (page >= MAX_PAGES) break;
                    }
                }
                
                if (allProductData.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--text-muted);">No product data available. Upload product performance data to see breakdown.</td></tr>';
                    return;
                }
                
                // Aggregate by product
                const productMap = new Map();
                const productCreatorMap = new Map(); // For drilldown
                
                allProductData.forEach(row => {
                    const productKey = row.product_name || row.product_id || 'Unknown';
                    
                    if (!productMap.has(productKey)) {
                        productMap.set(productKey, {
                            product_name: productKey,
                            product_id: row.product_id,
                            gmv: 0,
                            orders: 0,
                            videos: 0,
                            creators: new Set(),
                            dailyGmv: {}
                        });
                    }
                    
                    const p = productMap.get(productKey);
                    p.gmv += pFloat(row.gmv);
                    p.orders += pInt(row.orders);
                    if (row.creator_name) p.creators.add(row.creator_name);
                    
                    // Track daily GMV for trend
                    const date = row.report_date;
                    p.dailyGmv[date] = (p.dailyGmv[date] || 0) + pFloat(row.gmv);
                    
                    // Track creator breakdown for drilldown
                    if (!productCreatorMap.has(productKey)) {
                        productCreatorMap.set(productKey, new Map());
                    }
                    const creatorMap = productCreatorMap.get(productKey);
                    if (row.creator_name) {
                        if (!creatorMap.has(row.creator_name)) {
                            creatorMap.set(row.creator_name, { gmv: 0, orders: 0, videos: 0 });
                        }
                        const c = creatorMap.get(row.creator_name);
                        c.gmv += pFloat(row.gmv);
                        c.orders += pInt(row.orders);
                    }
                });
                
                // Store for drilldown
                productBreakdownCache = {
                    brand,
                    startDate,
                    endDate,
                    products: productMap,
                    creatorsByProduct: productCreatorMap
                };
                
                // Sort by GMV descending
                const products = [...productMap.values()].sort((a, b) => b.gmv - a.gmv);
                
                // Calculate trend indicator (compare first half to second half of period)
                const getTrend = (dailyGmv) => {
                    const dates = Object.keys(dailyGmv).sort();
                    if (dates.length < 4) return 'neutral';
                    const mid = Math.floor(dates.length / 2);
                    const firstHalf = dates.slice(0, mid).reduce((s, d) => s + dailyGmv[d], 0);
                    const secondHalf = dates.slice(mid).reduce((s, d) => s + dailyGmv[d], 0);
                    if (secondHalf > firstHalf * 1.1) return 'up';
                    if (secondHalf < firstHalf * 0.9) return 'down';
                    return 'neutral';
                };
                
                tbody.innerHTML = products.slice(0, 20).map((p, i) => {
                    const pctOfTotal = totalBrandGmv > 0 ? (p.gmv / totalBrandGmv * 100) : 0;
                    const trend = getTrend(p.dailyGmv);
                    const trendIcon = trend === 'up' ? '📈' : trend === 'down' ? '📉' : '➡️';
                    const trendColor = trend === 'up' ? 'var(--success)' : trend === 'down' ? 'var(--danger)' : 'var(--text-muted)';
                    
                    // Truncate long product names
                    const displayName = p.product_name.length > 50 
                        ? p.product_name.substring(0, 47) + '...' 
                        : p.product_name;
                    
                    return `<tr style="cursor: pointer;" onclick="showProductCreatorDrilldown('${encodeURIComponent(p.product_name)}')">
                        <td>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="font-size: 0.85rem; color: var(--text-muted);">${i + 1}.</span>
                                <span style="font-weight: 500;" title="${p.product_name}">${displayName}</span>
                            </div>
                        </td>
                        <td style="text-align: right; font-weight: 600; color: var(--accent);">${fmtMoney(p.gmv)}</td>
                        <td style="text-align: right;">
                            <div style="display: flex; align-items: center; justify-content: flex-end; gap: 8px;">
                                <div style="width: 60px; height: 6px; background: var(--bg-secondary); border-radius: 3px; overflow: hidden;">
                                    <div style="width: ${Math.min(pctOfTotal, 100)}%; height: 100%; background: var(--accent); border-radius: 3px;"></div>
                                </div>
                                <span style="min-width: 45px;">${pctOfTotal.toFixed(1)}%</span>
                            </div>
                        </td>
                        <td style="text-align: right;">${fmt(p.orders)}</td>
                        <td style="text-align: right;">${p.creators.size}</td>
                        <td style="text-align: center; color: ${trendColor};">${trendIcon}</td>
                    </tr>`;
                }).join('') || '<tr><td colspan="6"><div class="empty-state">No products found</div></td></tr>';
                
                // Show count if more than 20
                if (products.length > 20) {
                    tbody.innerHTML += `<tr><td colspan="6" style="text-align: center; padding: 12px; color: var(--text-muted); font-size: 0.85rem;">
                        Showing top 20 of ${products.length} products
                    </td></tr>`;
                }
                
            } catch (err) {
                console.error('Failed to load product breakdown:', err);
                tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--danger);">Error loading products: ${err.message}</td></tr>`;
            }
        }
        
        function showProductCreatorDrilldown(encodedProductName) {
            const productName = decodeURIComponent(encodedProductName);
            const drilldown = document.getElementById('productCreatorDrilldown');
            const tbody = document.getElementById('productCreatorsBody');
            const brand = productBreakdownCache.brand;
            
            document.getElementById('drilldownProductName').textContent = productName.length > 40 
                ? productName.substring(0, 37) + '...' 
                : productName;
            
            const creatorMap = productBreakdownCache.creatorsByProduct?.get(productName);
            
            if (!creatorMap || creatorMap.size === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--text-muted);">No creator data for this product</td></tr>';
            } else {
                const creators = [...creatorMap.entries()]
                    .map(([name, data]) => ({ creator_name: name, ...data }))
                    .sort((a, b) => b.gmv - a.gmv);
                
                tbody.innerHTML = creators.slice(0, 25).map((c, i) => {
                    const managed = isManagedForBrand(c.creator_name, brand);
                    return `<tr>
                        <td style="text-align: center; font-weight: 600; color: ${i < 3 ? 'var(--accent)' : 'var(--text-muted)'};">${i + 1}</td>
                        <td>
                            <div class="creator-cell">
                                <div class="creator-avatar">${c.creator_name.charAt(0).toUpperCase()}</div>
                                <span class="creator-name">${c.creator_name}</span>
                            </div>
                        </td>
                        <td><span class="badge ${managed ? 'badge-managed' : 'badge-unmanaged'}">${managed ? '✓ Managed' : 'Unmanaged'}</span></td>
                        <td style="text-align: right; font-weight: 600; color: var(--accent);">${fmtMoney(c.gmv)}</td>
                        <td style="text-align: right;">${fmt(c.orders)}</td>
                        <td style="text-align: right;">${c.videos || '-'}</td>
                    </tr>`;
                }).join('');
                
                if (creators.length > 25) {
                    tbody.innerHTML += `<tr><td colspan="6" style="text-align: center; padding: 12px; color: var(--text-muted); font-size: 0.85rem;">
                        Showing top 25 of ${creators.length} creators
                    </td></tr>`;
                }
            }
            
            drilldown.style.display = 'block';
            drilldown.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        
        function closeProductDrilldown() {
            document.getElementById('productCreatorDrilldown').style.display = 'none';
        }

