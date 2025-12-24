// ==================== DAILY & WEEKLY OPS ====================
        // ==================== WEEKLY OPS ====================
        
        function applyWeekPreset() {
            const weekOffset = document.getElementById('weekSelector').value;
            if (weekOffset === 'custom') return; // Don't change dates for custom
            
            const offset = parseInt(weekOffset) || 0;
            const today = new Date();
            
            const weekEnd = new Date(today);
            weekEnd.setDate(weekEnd.getDate() - 1 - (offset * 7));
            const weekStart = new Date(weekEnd);
            weekStart.setDate(weekStart.getDate() - 6);
            
            const startPicker = document.getElementById('weeklyStartDate');
            const endPicker = document.getElementById('weeklyEndDate');
            
            if (startPicker._flatpickr && endPicker._flatpickr) {
                startPicker._flatpickr.setDate(localDateStr(weekStart), false);
                endPicker._flatpickr.setDate(localDateStr(weekEnd), false);
            }
            
            loadWeeklyOps();
        }
        
        async function loadWeeklyOps() {
            showLoading('weeklyops', 'Loading weekly performance...');
            try {
            const today = new Date();
            
            // Get dates from pickers
            const startPickerEl = document.getElementById('weeklyStartDate');
            const endPickerEl = document.getElementById('weeklyEndDate');
            
            let thisWeekStartStr, thisWeekEndStr;
            
            if (startPickerEl && startPickerEl.value && endPickerEl && endPickerEl.value) {
                thisWeekStartStr = startPickerEl.value;
                thisWeekEndStr = endPickerEl.value;
            } else {
                // Smart default: use most recent date with data as week end
                let weekEndDate;
                if (availableDates.daily && availableDates.daily.length > 0) {
                    weekEndDate = new Date(availableDates.daily[0] + 'T12:00:00'); // Most recent date with data
                } else {
                    // Fetch latest date directly from database
                    const { data: latestDate } = await supabaseClient
                        .from('creator_performance')
                        .select('report_date')
                        .eq('period_type', 'daily')
                        .order('report_date', { ascending: false })
                        .limit(1)
                        .single();
                    
                    if (latestDate && latestDate.report_date) {
                        weekEndDate = new Date(latestDate.report_date + 'T12:00:00');
                    } else {
                        weekEndDate = new Date(today);
                        weekEndDate.setDate(weekEndDate.getDate() - 1);
                    }
                }
                const weekStartDate = new Date(weekEndDate);
                weekStartDate.setDate(weekStartDate.getDate() - 6);
                thisWeekStartStr = localDateStr(weekStartDate);
                thisWeekEndStr = localDateStr(weekEndDate);
            }
            
            const brandFilter = document.getElementById('weeklyBrandFilter').value;
            const brandLabel = brandFilter === 'all' ? 'All Brands' : (BRAND_DISPLAY[brandFilter] || brandFilter);

            document.getElementById('weeklyOpsDate').textContent = 
                `${formatDate(thisWeekStartStr)} → ${formatDate(thisWeekEndStr)} | ${brandLabel} | Generated: ${today.toLocaleTimeString()}`;

            // Check if data is stale (week end is not yesterday)
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            const weekEndDate = new Date(thisWeekEndStr + 'T12:00:00');
            const daysDiff = Math.floor((yesterday - weekEndDate) / (1000 * 60 * 60 * 24));
            
            // Show/hide stale data warning
            let staleWarning = document.getElementById('weeklyStaleWarning');
            if (!staleWarning) {
                staleWarning = document.createElement('div');
                staleWarning.id = 'weeklyStaleWarning';
                staleWarning.style.cssText = 'background: var(--warning-dim); border: 1px solid var(--warning); border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; display: flex; align-items: center; gap: 10px;';
                const weeklyContent = document.getElementById('weeklyContent');
                if (weeklyContent) {
                    weeklyContent.insertBefore(staleWarning, weeklyContent.firstChild);
                }
            }
            
            if (daysDiff > 0) {
                staleWarning.innerHTML = `
                    <span style="font-size: 1.3rem;">⚠️</span>
                    <div>
                        <strong style="color: var(--warning);">Data is ${daysDiff} day${daysDiff > 1 ? 's' : ''} old</strong>
                        <div style="color: var(--text-secondary); font-size: 0.85rem;">Week ending ${formatDate(thisWeekEndStr)} — latest available data. New data uploads needed.</div>
                    </div>
                `;
                staleWarning.style.display = 'flex';
            } else {
                staleWarning.style.display = 'none';
            }

            // Use RPC function for aggregated data
            let weeklyData = null;
            const { data: rpcData, error: rpcError } = await supabaseClient.rpc('get_weekly_ops_data', {
                p_brand: brandFilter === 'all' ? null : brandFilter,
                p_week_start: thisWeekStartStr,
                p_week_end: thisWeekEndStr
            }).limit(50000);

            if (rpcError) {
                console.warn('RPC not available, using fallback query:', rpcError.message);
                // Fallback: direct query with aggregation in JS
                let query = supabaseClient
                    .from('creator_performance')
                    .select('creator_name, brand, gmv, orders, videos, refunds, est_commission, report_date')
                    .gte('report_date', thisWeekStartStr)
                    .lte('report_date', thisWeekEndStr)
                    .eq('period_type', 'daily')
                    .limit(50000);
                
                if (brandFilter !== 'all') {
                    query = query.eq('brand', brandFilter);
                }
                
                const { data: fallbackData, error: fallbackError } = await query;
                if (fallbackError) {
                    console.error('Fallback query also failed:', fallbackError);
                    return;
                }
                
                // Aggregate by creator_name + brand
                const aggregated = {};
                (fallbackData || []).forEach(row => {
                    const key = `${row.creator_name}|${row.brand}`;
                    if (!aggregated[key]) {
                        aggregated[key] = {
                            creator_name: row.creator_name,
                            brand: row.brand,
                            gmv: 0, orders: 0, videos: 0, refunds: 0, est_commission: 0,
                            days_active: 0
                        };
                    }
                    aggregated[key].gmv += pFloat(row.gmv);
                    aggregated[key].orders += pInt(row.orders);
                    aggregated[key].videos += pInt(row.videos);
                    aggregated[key].refunds += pFloat(row.refunds);
                    aggregated[key].est_commission += pFloat(row.est_commission);
                    aggregated[key].days_active++;
                });
                weeklyData = Object.values(aggregated);
            } else {
                weeklyData = rpcData;
            }

            // Process the data
            const creators = (weeklyData || []).map(row => ({
                name: row.creator_name,
                brand: row.brand,
                gmv: pFloat(row.gmv),
                orders: pInt(row.orders),
                videos: pInt(row.videos),
                refunds: pFloat(row.refunds),
                commission: pFloat(row.est_commission),
                daysActive: pInt(row.days_active),
                priorGmv: pFloat(row.prior_week_gmv),
                priorOrders: pInt(row.prior_week_orders),
                priorVideos: pInt(row.prior_week_videos),
                gmvChange: pFloat(row.prior_week_gmv) > 0 
                    ? ((pFloat(row.gmv) - pFloat(row.prior_week_gmv)) / pFloat(row.prior_week_gmv) * 100) 
                    : (pFloat(row.gmv) > 0 ? 100 : 0)
            }));

            // Calculate totals by brand
            const brandTotals = {};
            creators.forEach(c => {
                if (!brandTotals[c.brand]) {
                    brandTotals[c.brand] = { gmv: 0, orders: 0, videos: 0, creators: 0, priorGmv: 0, priorOrders: 0 };
                }
                brandTotals[c.brand].gmv += c.gmv;
                brandTotals[c.brand].orders += c.orders;
                brandTotals[c.brand].videos += c.videos;
                brandTotals[c.brand].creators++;
                brandTotals[c.brand].priorGmv += c.priorGmv;
                brandTotals[c.brand].priorOrders += c.priorOrders;
            });

            // Calculate overall totals
            const totalGmv = creators.reduce((s, c) => s + c.gmv, 0);
            const totalOrders = creators.reduce((s, c) => s + c.orders, 0);
            const totalVideos = creators.reduce((s, c) => s + c.videos, 0);
            const priorTotalGmv = creators.reduce((s, c) => s + c.priorGmv, 0);
            const priorTotalVideos = creators.reduce((s, c) => s + c.priorVideos, 0);
            
            const gmvChange = priorTotalGmv > 0 ? ((totalGmv - priorTotalGmv) / priorTotalGmv * 100) : 0;
            const videosChange = priorTotalVideos > 0 ? ((totalVideos - priorTotalVideos) / priorTotalVideos * 100) : 0;

            // Detect winners and attention
            const winners = detectWeeklyWinners(creators);
            const attention = detectWeeklyAttention(creators);

            // Store globally
            window.weeklyCreators = creators;
            window.weeklyBrandTotals = brandTotals;
            window.weeklyWinners = winners;
            window.weeklyAttention = attention;

            // Update stats
            document.getElementById('weeklyTotalGmv').textContent = fmtMoney(totalGmv);
            document.getElementById('weeklyGmvChange').textContent = `${gmvChange >= 0 ? '+' : ''}${gmvChange.toFixed(1)}% WoW`;
            document.getElementById('weeklyGmvChange').className = `stat-change ${gmvChange >= 0 ? 'positive' : 'negative'}`;
            document.getElementById('weeklyTotalVideos').textContent = fmt(totalVideos);
            document.getElementById('weeklyVideosChange').textContent = `${videosChange >= 0 ? '+' : ''}${videosChange.toFixed(0)}% WoW`;
            document.getElementById('weeklyVideosChange').className = `stat-change ${videosChange >= 0 ? 'positive' : 'negative'}`;
            document.getElementById('weeklyGrowingCount').textContent = winners.length;
            document.getElementById('weeklyAttentionCount').textContent = attention.length;
            document.getElementById('weeklyManagedAttention').textContent = `${attention.filter(a => isManagedForBrand(a.name, a.brand)).length} managed`;

            // Generate copyable summary
            generateWeeklySummaryText(creators, brandTotals, winners, attention, thisWeekStartStr, thisWeekEndStr, brandLabel);

            // Build brand board
            buildWeeklyBrandBoard(creators, winners, attention, brandTotals);

            // Render tables
            renderWeeklyWinners(winners);
            renderWeeklyAttention(attention);
            } finally {
                hideLoading('weeklyops');
            }
        }

        function detectWeeklyWinners(creators) {
            const winners = [];
            
            creators.forEach(c => {
                // Only include managed creators
                if (!isManagedForBrand(c.name, c.brand)) return;
                
                const reasons = [];
                
                // Top performer ($1000+ weekly)
                if (c.gmv >= 1000) {
                    reasons.push({ type: 'top_performer', msg: `💰 ${fmtMoney(c.gmv)} weekly GMV` });
                }
                
                // Big growth (50%+ with meaningful prior)
                if (c.gmvChange >= 50 && c.priorGmv >= 100) {
                    reasons.push({ type: 'growth', msg: `📈 +${c.gmvChange.toFixed(0)}% WoW growth` });
                }
                
                // Consistent poster (5+ videos)
                if (c.videos >= 5) {
                    reasons.push({ type: 'consistent', msg: `🎬 ${c.videos} videos this week` });
                }
                
                // Active all week (6-7 days)
                if (c.daysActive >= 6) {
                    reasons.push({ type: 'dedication', msg: `⭐ Active ${c.daysActive} days` });
                }
                
                // Breakout (low prior, high now)
                if (c.gmv >= 500 && c.priorGmv < 100) {
                    reasons.push({ type: 'breakout', msg: `🌟 Breakout week!` });
                }

                if (reasons.length > 0) {
                    winners.push({ ...c, reasons });
                }
            });

            winners.sort((a, b) => b.gmv - a.gmv);
            return winners;
        }

        function detectWeeklyAttention(creators) {
            const attention = [];
            
            creators.forEach(c => {
                // Only include managed creators
                if (!isManagedForBrand(c.name, c.brand)) return;
                
                const issues = [];
                
                // Big GMV drop (30%+ decline)
                if (c.priorGmv >= 200 && c.gmv < c.priorGmv * 0.7) {
                    const dropPct = ((c.priorGmv - c.gmv) / c.priorGmv * 100).toFixed(0);
                    issues.push({ type: 'gmv_drop', severity: 2, msg: `📉 GMV down ${dropPct}% (${fmtMoney(c.priorGmv)} → ${fmtMoney(c.gmv)})` });
                }
                
                // Went inactive (had activity, now minimal)
                if (c.priorGmv >= 100 && c.gmv < 20) {
                    issues.push({ type: 'inactive', severity: 3, msg: `⚠️ Nearly inactive (was ${fmtMoney(c.priorGmv)})` });
                }
                
                // Stopped posting
                if (c.priorVideos >= 3 && c.videos <= 1) {
                    issues.push({ type: 'no_content', severity: 2, msg: `📭 Only ${c.videos} video (was ${c.priorVideos})` });
                }
                
                // Low activity days
                if (c.daysActive <= 2 && c.priorGmv >= 100) {
                    issues.push({ type: 'low_activity', severity: 1, msg: `😴 Only active ${c.daysActive} days` });
                }

                if (issues.length > 0) {
                    issues.sort((a, b) => b.severity - a.severity);
                    attention.push({ ...c, issues });
                }
            });

            attention.sort((a, b) => {
                const severityA = Math.max(...a.issues.map(i => i.severity));
                const severityB = Math.max(...b.issues.map(i => i.severity));
                if (severityB !== severityA) return severityB - severityA;
                return b.priorGmv - a.priorGmv;
            });
            
            return attention;
        }

        function generateWeeklySummaryText(creators, brandTotals, winners, attention, startDate, endDate, brandLabel) {
            const totalGmv = creators.reduce((s, c) => s + c.gmv, 0);
            const totalOrders = creators.reduce((s, c) => s + c.orders, 0);
            const totalVideos = creators.reduce((s, c) => s + c.videos, 0);
            const priorTotalGmv = creators.reduce((s, c) => s + c.priorGmv, 0);
            const gmvChange = priorTotalGmv > 0 ? ((totalGmv - priorTotalGmv) / priorTotalGmv * 100) : 0;
            const activeCreators = creators.filter(c => c.gmv > 0).length;

            const emoji = gmvChange >= 10 ? '🚀' : gmvChange >= 0 ? '✅' : gmvChange >= -10 ? '📊' : '⚠️';
            
            let summary = `📅 WEEKLY REPORT - ${brandLabel}
${formatDate(startDate)} → ${formatDate(endDate)}

${emoji} OVERALL PERFORMANCE
━━━━━━━━━━━━━━━━━━━━
💰 Total GMV: ${fmtMoney(totalGmv)} (${gmvChange >= 0 ? '+' : ''}${gmvChange.toFixed(1)}% WoW)
📦 Orders: ${fmt(totalOrders)}
🎬 Videos: ${fmt(totalVideos)}
👥 Active Creators: ${activeCreators}
🏆 Winners: ${winners.length}
⚠️ Need Attention: ${attention.length}

`;

            // Brand breakdown
            if (Object.keys(brandTotals).length > 1) {
                summary += `📊 BY BRAND\n━━━━━━━━━━━━━━━━━━━━\n`;
                Object.entries(brandTotals)
                    .sort((a, b) => b[1].gmv - a[1].gmv)
                    .forEach(([brand, data]) => {
                        const change = data.priorGmv > 0 ? ((data.gmv - data.priorGmv) / data.priorGmv * 100) : 0;
                        const icon = change >= 10 ? '🟢' : change >= -10 ? '🟡' : '🔴';
                        summary += `${icon} ${BRAND_DISPLAY[brand]}: ${fmtMoney(data.gmv)} (${change >= 0 ? '+' : ''}${change.toFixed(0)}% WoW) | ${data.creators} creators\n`;
                    });
                summary += '\n';
            }

            // Top winners
            if (winners.length > 0) {
                summary += `🏆 TOP PERFORMERS\n━━━━━━━━━━━━━━━━━━━━\n`;
                winners.slice(0, 5).forEach((w, i) => {
                    summary += `${i + 1}. ${w.name} (${BRAND_DISPLAY[w.brand]}): ${fmtMoney(w.gmv)} - ${w.reasons[0].msg}\n`;
                });
                summary += '\n';
            }

            // Attention needed
            if (attention.length > 0) {
                summary += `⚠️ NEEDS FOLLOW-UP\n━━━━━━━━━━━━━━━━━━━━\n`;
                attention.slice(0, 5).forEach((a, i) => {
                    const managed = isManagedForBrand(a.name, a.brand) ? ' [MANAGED]' : '';
                    summary += `${i + 1}. ${a.name}${managed} (${BRAND_DISPLAY[a.brand]}): ${a.issues[0].msg}\n`;
                });
            }

            document.getElementById('weeklySummaryContent').textContent = summary;
        }

        function buildWeeklyBrandBoard(creators, winners, attention, brandTotals) {
            const allBrands = ['catakor', 'jiyu', 'physicians_choice', 'peach_slices', 'yerba_magic'];
            const container = document.getElementById('weeklyBrandBoard');
            const checklistContainer = document.getElementById('weeklyBrandChecklistItems');
            
            // Debug logging
            console.log('Weekly brand totals:', brandTotals);
            
            // Group by brand
            const winnersByBrand = {};
            const attentionByBrand = {};
            
            allBrands.forEach(brand => {
                winnersByBrand[brand] = winners.filter(w => w.brand === brand);
                attentionByBrand[brand] = attention.filter(a => a.brand === brand);
            });

            // Also check for brand keys that might be different format
            Object.keys(brandTotals).forEach(key => {
                if (!allBrands.includes(key)) {
                    console.log('Found unexpected brand key:', key);
                    winnersByBrand[key] = winners.filter(w => w.brand === key);
                    attentionByBrand[key] = attention.filter(a => a.brand === key);
                }
            });

            window.weeklyWinnersByBrand = winnersByBrand;
            window.weeklyAttentionByBrand = attentionByBrand;

            // Use actual brand keys from data, falling back to allBrands
            const brandsToShow = Object.keys(brandTotals).length > 0 ? 
                [...new Set([...allBrands, ...Object.keys(brandTotals)])] : allBrands;

            let totalActions = 0;
            container.innerHTML = brandsToShow.filter(brand => allBrands.includes(brand) || brandTotals[brand]).map(brand => {
                const data = brandTotals[brand] || { gmv: 0, orders: 0, videos: 0, creators: 0, priorGmv: 0 };
                const brandWinners = winnersByBrand[brand] || [];
                const brandAttention = attentionByBrand[brand] || [];
                const actions = brandWinners.length + brandAttention.length;
                totalActions += actions;
                
                const change = data.priorGmv > 0 ? ((data.gmv - data.priorGmv) / data.priorGmv * 100) : 0;
                const healthClass = change >= 10 ? 'health-great' : change >= -10 ? 'health-ok' : 'health-bad';
                const isComplete = window.completedWeeklyBrands?.has(brand);
                const displayName = BRAND_DISPLAY[brand] || brand;
                
                return `
                    <div class="brand-action-card ${healthClass} ${isComplete ? 'completed' : ''}" onclick="showWeeklyBrandDetail('${brand}')">
                        <div class="brand-card-header">
                            <span class="brand-name">${displayName}</span>
                            ${isComplete ? '<span class="complete-badge">✅</span>' : ''}
                        </div>
                        <div class="brand-card-stats">
                            <div class="stat">${fmtMoney(data.gmv)}</div>
                            <div class="stat-change ${change >= 0 ? 'positive' : 'negative'}">${change >= 0 ? '+' : ''}${change.toFixed(0)}% WoW</div>
                        </div>
                        <div class="brand-card-actions">
                            ${brandWinners.length > 0 ? `<span class="action-badge wins">🏆 ${brandWinners.length}</span>` : ''}
                            ${brandAttention.length > 0 ? `<span class="action-badge attention">⚠️ ${brandAttention.length}</span>` : ''}
                            ${actions === 0 ? '<span class="action-badge neutral">✓ Stable</span>' : ''}
                        </div>
                    </div>
                `;
            }).join('');

            document.getElementById('weeklyTotalActions').textContent = `${totalActions} total actions`;

            // Checklist
            if (checklistContainer) {
                checklistContainer.innerHTML = allBrands.map(brand => {
                    const isComplete = window.completedWeeklyBrands?.has(brand);
                    const displayName = BRAND_DISPLAY[brand] || brand;
                    return `
                        <label class="checklist-item ${isComplete ? 'completed' : ''}">
                            <input type="checkbox" ${isComplete ? 'checked' : ''} onchange="toggleWeeklyBrandComplete('${brand}', this.checked)">
                            <span>${displayName}</span>
                        </label>
                    `;
                }).join('');
            }

            updateWeeklyProgress();
        }

        function showWeeklyBrandDetail(brand) {
            const brandTotals = window.weeklyBrandTotals || {};
            const data = brandTotals[brand] || { gmv: 0, orders: 0, videos: 0, creators: 0, priorGmv: 0 };
            const brandWinners = window.weeklyWinnersByBrand?.[brand] || [];
            const brandAttention = window.weeklyAttentionByBrand?.[brand] || [];

            window.currentWeeklyBrand = brand;
            const change = data.priorGmv > 0 ? ((data.gmv - data.priorGmv) / data.priorGmv * 100) : 0;

            // Update header
            document.getElementById('weeklyBrandDetailName').textContent = BRAND_DISPLAY[brand];
            
            // Update stats
            document.getElementById('weeklyBrandGmv').textContent = fmtMoney(data.gmv);
            document.getElementById('weeklyBrandChange').textContent = `${change >= 0 ? '+' : ''}${change.toFixed(0)}%`;
            document.getElementById('weeklyBrandChange').className = `value ${change >= 0 ? 'positive' : 'negative'}`;
            document.getElementById('weeklyBrandOrders').textContent = fmt(data.orders);
            document.getElementById('weeklyBrandCreators').textContent = fmt(data.creators);

            // Winners
            document.getElementById('weeklyBrandWinnersCount').textContent = brandWinners.length;
            document.getElementById('weeklyBrandWinnersContainer').innerHTML = brandWinners.length > 0 
                ? brandWinners.map(w => `
                    <div class="action-item win">
                        <div class="action-header">
                            <strong>${w.name}</strong>
                            <span class="gmv">${fmtMoney(w.gmv)}</span>
                        </div>
                        <div class="action-reasons">${w.reasons.map(r => r.msg).join(' • ')}</div>
                        <div class="action-buttons">
                            <button class="btn btn-tiny" onclick="copyWeeklyWinMessage('${w.name}', '${brand}', ${w.gmv})">📋 Copy Shoutout</button>
                        </div>
                    </div>
                `).join('')
                : '<p class="empty-message">No standout performers this week</p>';

            // Attention
            document.getElementById('weeklyBrandAttentionCount').textContent = brandAttention.length;
            document.getElementById('weeklyBrandAttentionContainer').innerHTML = brandAttention.length > 0 
                ? brandAttention.map(a => `
                    <div class="action-item attention">
                        <div class="action-header">
                            <strong>${a.name}</strong>
                            <span class="prior-gmv">Last wk: ${fmtMoney(a.priorGmv)}</span>
                        </div>
                        <div class="action-issues">${a.issues.map(i => i.msg).join(' • ')}</div>
                        <div class="action-buttons">
                            <button class="btn btn-tiny" onclick="copyWeeklyFollowupMessage('${a.name}', '${brand}')">📋 Copy DM</button>
                        </div>
                    </div>
                `).join('')
                : '<p class="empty-message">All creators performing well</p>';

            // Client talking points
            const talkingPoints = generateClientTalkingPoints(brand, data, brandWinners, brandAttention);
            document.getElementById('weeklyBrandTalkingPoints').innerHTML = talkingPoints;

            // Show detail
            document.getElementById('weeklyBrandDetail').style.display = 'block';
            document.getElementById('weeklyBrandBoard').parentElement.parentElement.style.display = 'none';
        }

        function generateClientTalkingPoints(brand, data, winners, attention) {
            const change = data.priorGmv > 0 ? ((data.gmv - data.priorGmv) / data.priorGmv * 100) : 0;
            const emoji = change >= 10 ? '🚀' : change >= 0 ? '✅' : '⚠️';
            
            let points = `<strong>${emoji} Overall:</strong> ${fmtMoney(data.gmv)} GMV this week (${change >= 0 ? '+' : ''}${change.toFixed(0)}% WoW)<br><br>`;
            
            if (winners.length > 0) {
                points += `<strong>🏆 Highlights:</strong><br>`;
                winners.slice(0, 3).forEach(w => {
                    points += `• ${w.name}: ${fmtMoney(w.gmv)} - ${w.reasons[0].msg}<br>`;
                });
                points += '<br>';
            }
            
            if (attention.length > 0) {
                points += `<strong>📋 Action Items:</strong><br>`;
                points += `• ${attention.length} creator(s) need outreach this week<br>`;
                if (attention.some(a => a.issues.some(i => i.type === 'inactive'))) {
                    points += `• Re-engagement campaign for inactive creators<br>`;
                }
            } else {
                points += `<strong>✅ Health:</strong> All creators performing as expected`;
            }
            
            return points;
        }

        function closeWeeklyBrandDetail() {
            document.getElementById('weeklyBrandDetail').style.display = 'none';
            document.getElementById('weeklyBrandBoard').parentElement.parentElement.style.display = 'block';
        }

        function markWeeklyBrandComplete() {
            if (window.currentWeeklyBrand) {
                toggleWeeklyBrandComplete(window.currentWeeklyBrand, true);
                closeWeeklyBrandDetail();
            }
        }

        function toggleWeeklyBrandComplete(brand, complete) {
            if (complete) {
                window.completedWeeklyBrands.add(brand);
            } else {
                window.completedWeeklyBrands.delete(brand);
            }
            saveCompletedWeeklyBrands();
            buildWeeklyBrandBoard(window.weeklyCreators || [], window.weeklyWinners || [], window.weeklyAttention || [], window.weeklyBrandTotals || {});
        }

        function updateWeeklyProgress() {
            const total = 5;
            const completed = window.completedWeeklyBrands?.size || 0;
            const pct = (completed / total) * 100;
            document.getElementById('weeklyChecklistProgressBar').style.width = `${pct}%`;
        }

        function renderWeeklyWinners(winners) {
            document.getElementById('winnersListCount').textContent = winners.length;
            document.getElementById('winnersTableBody').innerHTML = winners.length > 0
                ? winners.map(w => {
                    const managed = isManagedForBrand(w.name, w.brand);
                    return `
                        <tr>
                            <td><strong>${w.name}</strong></td>
                            <td><span class="badge-brand">${BRAND_DISPLAY[w.brand]}</span></td>
                            <td>${w.reasons[0].msg}</td>
                            <td class="gmv-value">${fmtMoney(w.gmv)}</td>
                            <td>${fmtMoney(w.priorGmv)}</td>
                            <td class="${w.gmvChange >= 0 ? 'positive' : 'negative'}">${w.gmvChange >= 0 ? '+' : ''}${w.gmvChange.toFixed(0)}%</td>
                            <td>${w.videos}</td>
                            <td>${managed ? '<span class="badge-managed">Managed</span>' : '<span class="badge-unmanaged">Unmanaged</span>'}</td>
                        </tr>
                    `;
                }).join('')
                : '<tr><td colspan="8"><div class="empty-state"><h3>No winners this week</h3></div></td></tr>';

            // Copy version
            let copyText = `🏆 WEEKLY WINNERS\n━━━━━━━━━━━━━━━━━━━━\n\n`;
            winners.forEach((w, i) => {
                copyText += `${i + 1}. ${w.name} (${BRAND_DISPLAY[w.brand]})\n   ${fmtMoney(w.gmv)} | ${w.reasons[0].msg}\n\n`;
            });
            document.getElementById('weeklyWinnersContent').textContent = copyText;
        }

        function renderWeeklyAttention(attention) {
            document.getElementById('attentionListCount').textContent = attention.length;
            document.getElementById('attentionTableBody').innerHTML = attention.length > 0
                ? attention.map(a => {
                    const managed = isManagedForBrand(a.name, a.brand);
                    return `
                        <tr>
                            <td><strong>${a.name}</strong></td>
                            <td><span class="badge-brand">${BRAND_DISPLAY[a.brand]}</span></td>
                            <td>${a.issues.map(i => i.msg).join('<br>')}</td>
                            <td>${fmtMoney(a.gmv)}</td>
                            <td>${fmtMoney(a.priorGmv)}</td>
                            <td class="negative">${a.gmvChange.toFixed(0)}%</td>
                            <td>${a.videos} (${a.daysActive}d)</td>
                            <td>${managed ? '<span class="badge-managed">Managed</span>' : '<span class="badge-unmanaged">Unmanaged</span>'}</td>
                        </tr>
                    `;
                }).join('')
                : '<tr><td colspan="8"><div class="empty-state"><h3>All creators healthy!</h3></div></td></tr>';
        }

        function copyWeeklyWinMessage(name, brand, gmv) {
            const msg = `🏆 WEEKLY WINNER 🏆

Huge shoutout to @${name}! 

Absolutely crushed it this week with ${fmtMoney(gmv)} in sales! 💰🔥

This is what consistency and great content looks like! Keep it up! 🚀`;
            navigator.clipboard.writeText(msg);
            showToast('Weekly win message copied!');
        }

        function copyWeeklyFollowupMessage(name, brand) {
            const msg = `Hey @${name}! 👋

Hope you're doing well! Just wanted to check in - I noticed things slowed down a bit this week.

How's everything going? Anything I can help with? Whether it's content ideas, product selection, or just brainstorming - I'm here for you!

Let's get you back to crushing it 💪`;
            navigator.clipboard.writeText(msg);
            showToast('Follow-up message copied!');
        }

        function copyWeeklyBrandReport() {
            const brand = window.currentWeeklyBrand;
            if (!brand) return;
            
            const data = window.weeklyBrandTotals?.[brand] || {};
            const winners = window.weeklyWinnersByBrand?.[brand] || [];
            const attention = window.weeklyAttentionByBrand?.[brand] || [];
            const change = data.priorGmv > 0 ? ((data.gmv - data.priorGmv) / data.priorGmv * 100) : 0;

            let report = `📊 ${BRAND_DISPLAY[brand]} - Weekly Report
━━━━━━━━━━━━━━━━━━━━

💰 GMV: ${fmtMoney(data.gmv)} (${change >= 0 ? '+' : ''}${change.toFixed(0)}% WoW)
📦 Orders: ${fmt(data.orders)}
🎬 Videos: ${fmt(data.videos)}
👥 Active Creators: ${data.creators}

`;
            if (winners.length > 0) {
                report += `🏆 TOP PERFORMERS:\n`;
                winners.slice(0, 5).forEach(w => {
                    report += `• ${w.name}: ${fmtMoney(w.gmv)}\n`;
                });
                report += '\n';
            }
            
            if (attention.length > 0) {
                report += `⚠️ NEED OUTREACH:\n`;
                attention.slice(0, 5).forEach(a => {
                    report += `• ${a.name}: ${a.issues[0].msg}\n`;
                });
            }

            navigator.clipboard.writeText(report);
            showToast('Brand report copied!');
        }

        function toggleWinnersView() {
            const tableView = document.getElementById('winnersTableView');
            const copyView = document.getElementById('winnersCopyView');
            if (tableView.style.display === 'none') {
                tableView.style.display = 'block';
                copyView.style.display = 'none';
            } else {
                tableView.style.display = 'none';
                copyView.style.display = 'block';
            }
        }

        function toggleAttentionView() {
            const tableView = document.getElementById('attentionTableView');
            const copyView = document.getElementById('attentionCopyView');
            if (!copyView) return;
            if (tableView.style.display === 'none') {
                tableView.style.display = 'block';
                copyView.style.display = 'none';
            } else {
                tableView.style.display = 'none';
                copyView.style.display = 'block';
            }
        }

        function generateWeeklySummary(thisWeekData, priorWeekData, startDate, endDate, brandLabel) {
            // Calculate totals
            let totalGmv = 0, totalOrders = 0, totalVideos = 0;
            let priorGmv = 0, priorOrders = 0, priorVideos = 0;
            const activeCreators = new Set();

            thisWeekData.forEach(row => {
                totalGmv += pFloat(row.gmv);
                totalOrders += pInt(row.orders);
                totalVideos += pInt(row.videos);
                activeCreators.add(row.creator_name);
            });

            priorWeekData.forEach(row => {
                priorGmv += pFloat(row.gmv);
                priorOrders += pInt(row.orders);
                priorVideos += pInt(row.videos);
            });

            const gmvChange = priorGmv > 0 ? ((totalGmv - priorGmv) / priorGmv * 100) : 0;
            const ordersChange = priorOrders > 0 ? ((totalOrders - priorOrders) / priorOrders * 100) : 0;
            const videosChange = priorVideos > 0 ? ((totalVideos - priorVideos) / priorVideos * 100) : 0;

            const winnersCount = window.weeklyWinners?.length || 0;
            const attentionCount = window.weeklyAttentionList?.length || 0;

            const summary = `📊 WEEKLY SUMMARY - ${brandLabel}
Week of ${formatDate(startDate)} → ${formatDate(endDate)}

💰 Total GMV: ${fmtMoney(totalGmv)} (${gmvChange >= 0 ? '+' : ''}${gmvChange.toFixed(1)}% WoW)
📦 Orders: ${fmt(totalOrders)} (${ordersChange >= 0 ? '+' : ''}${ordersChange.toFixed(1)}% WoW)
🎬 Videos: ${fmt(totalVideos)} (${videosChange >= 0 ? '+' : ''}${videosChange.toFixed(1)}% WoW)
👥 Active Creators: ${activeCreators.size}

🏆 Winners: ${winnersCount} creators crushing it
⚠️ Attention: ${attentionCount} creators need follow-up

${gmvChange >= 10 ? '✅ Strong week overall!' : gmvChange <= -10 ? '⚠️ GMV down - worth investigating' : '📊 Steady week'}`;

            document.getElementById('weeklySummaryContent').textContent = summary;
        }

        async function generateCreatorAttentionList(thisWeekData, priorWeekData, startDate, endDate, brandFilter) {
            // Aggregate this week by creator
            const thisWeekCreators = {};
            thisWeekData.forEach(row => {
                const key = `${row.creator_name}|||${row.brand}`;
                if (!thisWeekCreators[key]) {
                    thisWeekCreators[key] = { 
                        name: row.creator_name, 
                        brand: row.brand, 
                        gmv: 0, 
                        orders: 0, 
                        videos: 0,
                        daysActive: new Set(),
                        dailyVideos: [] // Track videos per day for consistency
                    };
                }
                thisWeekCreators[key].gmv += pFloat(row.gmv);
                thisWeekCreators[key].orders += pInt(row.orders);
                thisWeekCreators[key].videos += pInt(row.videos);
                if (row.videos > 0 || row.gmv > 0) {
                    thisWeekCreators[key].daysActive.add(row.report_date);
                }
                if (row.videos > 0) {
                    thisWeekCreators[key].dailyVideos.push(row.videos);
                }
            });

            // Aggregate prior week by creator
            const priorWeekCreators = {};
            priorWeekData.forEach(row => {
                const key = `${row.creator_name}|||${row.brand}`;
                if (!priorWeekCreators[key]) {
                    priorWeekCreators[key] = { gmv: 0, orders: 0, videos: 0 };
                }
                priorWeekCreators[key].gmv += pFloat(row.gmv);
                priorWeekCreators[key].orders += pInt(row.orders);
                priorWeekCreators[key].videos += pInt(row.videos);
            });

            const attentionList = [];

            // Check each creator
            Object.entries(thisWeekCreators).forEach(([key, data]) => {
                const prior = priorWeekCreators[key] || { gmv: 0, orders: 0, videos: 0 };
                const brandDisplay = BRAND_DISPLAY[data.brand] || data.brand;
                const issues = [];

                // Check for GMV decline (>30% drop)
                if (prior.gmv > 100 && data.gmv < prior.gmv * 0.7) {
                    const dropPct = ((prior.gmv - data.gmv) / prior.gmv * 100).toFixed(0);
                    issues.push({
                        type: 'gmv_decline',
                        severity: prior.gmv > 1000 ? 3 : 2,
                        message: `GMV down ${dropPct}% (${fmtMoney(prior.gmv)} → ${fmtMoney(data.gmv)})`
                    });
                }

                // Check for low posting (less than 3 videos this week)
                if (data.videos < 3 && prior.videos >= 3) {
                    issues.push({
                        type: 'low_posting',
                        severity: 2,
                        message: `Only ${data.videos} video${data.videos !== 1 ? 's' : ''} this week (was ${prior.videos} last week)`
                    });
                }

                // Check for no activity (0 videos AND was active before)
                if (data.videos === 0 && prior.videos > 0) {
                    issues.push({
                        type: 'inactive',
                        severity: 3,
                        message: `No videos posted this week (had ${prior.videos} last week)`
                    });
                }

                // Check for tier risk (close to dropping)
                const currentTier = getTierFromGMV(data.gmv * 4); // Rough monthly projection
                const thresholds = Object.entries(TIER_THRESHOLDS).sort((a, b) => b[1] - a[1]);
                for (const [tier, threshold] of thresholds) {
                    if (data.gmv * 4 >= threshold && data.gmv * 4 < threshold * 1.2) {
                        issues.push({
                            type: 'tier_risk',
                            severity: 1,
                            message: `At risk of dropping from ${TIER_NAMES[tier]} tier`
                        });
                        break;
                    }
                }

                // Check for posting inconsistency (irregular posting pattern)
                let consistencyScore = 'steady';
                if (data.dailyVideos && data.dailyVideos.length >= 2) {
                    const maxDaily = Math.max(...data.dailyVideos);
                    const avgDaily = data.dailyVideos.reduce((a, b) => a + b, 0) / data.dailyVideos.length;
                    const daysWithVideos = data.dailyVideos.length;
                    
                    // Inconsistent if: max is 3x+ average, or posting on less than 3 days with total 5+ videos
                    if (maxDaily >= avgDaily * 3 || (daysWithVideos <= 2 && data.videos >= 5)) {
                        consistencyScore = 'inconsistent';
                        if (data.gmv >= 500) { // Only flag if meaningful creator
                            issues.push({
                                type: 'inconsistent',
                                severity: 1,
                                message: `Inconsistent posting (${daysWithVideos} active days, ${data.videos} videos)`
                            });
                        }
                    }
                }

                if (issues.length > 0) {
                    const maxSeverity = Math.max(...issues.map(i => i.severity));
                    attentionList.push({
                        name: data.name,
                        brand: brandDisplay,
                        brandKey: data.brand,
                        gmv: data.gmv,
                        priorGmv: prior.gmv,
                        videos: data.videos,
                        priorVideos: prior.videos,
                        daysActive: data.daysActive.size,
                        consistencyScore,
                        issues,
                        severity: maxSeverity,
                        isManaged: isManagedForBrand(data.name, data.brand)
                    });
                }
            });

            // Also check for creators who were active last week but not this week at all
            Object.entries(priorWeekCreators).forEach(([key, prior]) => {
                if (!thisWeekCreators[key] && prior.gmv > 100) {
                    const [name, brand] = key.split('|||');
                    const brandDisplay = BRAND_DISPLAY[brand] || brand;
                    attentionList.push({
                        name,
                        brand: brandDisplay,
                        brandKey: brand,
                        gmv: 0,
                        priorGmv: prior.gmv,
                        videos: 0,
                        priorVideos: prior.videos,
                        issues: [{
                            type: 'disappeared',
                            severity: 3,
                            message: `No activity this week (had ${fmtMoney(prior.gmv)} GMV last week)`
                        }],
                        severity: 3,
                        isManaged: isManagedForBrand(name, brand)
                    });
                }
            });

            // Sort by severity (highest first), then by prior GMV (biggest losses first)
            attentionList.sort((a, b) => {
                if (b.severity !== a.severity) return b.severity - a.severity;
                return b.priorGmv - a.priorGmv;
            });

            // Filter to only managed creators for Matt's list
            const managedAttention = attentionList.filter(c => c.isManaged);
            const unmanagedAttention = attentionList.filter(c => !c.isManaged);

            // Generate the message
            let msg = `⚠️ CREATOR ATTENTION LIST - Week of ${formatDate(startDate)}

`;

            if (managedAttention.length === 0 && unmanagedAttention.length === 0) {
                msg += `✅ All creators looking good this week! No major concerns.`;
            } else {
                if (managedAttention.length > 0) {
                    msg += `🔴 MANAGED CREATORS NEEDING ATTENTION (${managedAttention.length})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`;
                    managedAttention.slice(0, 15).forEach((c, i) => {
                        const severityIcon = c.severity >= 3 ? '🚨' : c.severity >= 2 ? '⚠️' : '📉';
                        msg += `${i + 1}. ${severityIcon} ${c.name} (${c.brand})
`;
                        c.issues.forEach(issue => {
                            msg += `   • ${issue.message}
`;
                        });
                        msg += `
`;
                    });

                    if (managedAttention.length > 15) {
                        msg += `   ... and ${managedAttention.length - 15} more managed creators needing attention

`;
                    }
                }

                if (unmanagedAttention.length > 0) {
                    msg += `
🟡 UNMANAGED CREATORS WITH ISSUES (${unmanagedAttention.length})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`;
                    // Just show top 10 unmanaged by prior GMV
                    unmanagedAttention.slice(0, 10).forEach((c, i) => {
                        msg += `${i + 1}. ${c.name} (${c.brand}) - ${c.issues[0].message}
`;
                    });

                    if (unmanagedAttention.length > 10) {
                        msg += `   ... and ${unmanagedAttention.length - 10} more

`;
                    }
                }

                msg += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 SUMMARY
• Managed creators needing attention: ${managedAttention.length}
• Unmanaged creators with issues: ${unmanagedAttention.length}
• Most common issue: ${getMostCommonIssue(attentionList)}`;
            }

            document.getElementById('creatorAttentionContent').textContent = msg;

            // Update stats and badge
            document.getElementById('weeklyAttentionCount').textContent = attentionList.length;
            document.getElementById('weeklyManagedAttention').textContent = `${managedAttention.length} managed`;
            const attentionListCount = document.getElementById('attentionListCount');
            if (attentionListCount) attentionListCount.textContent = attentionList.length;

            // Store for global access
            window.weeklyAttentionList = attentionList;

            // Populate attention by brand
            window.weeklyBrandAttention = {};
            attentionList.forEach(c => {
                if (!window.weeklyBrandAttention[c.brandKey]) {
                    window.weeklyBrandAttention[c.brandKey] = [];
                }
                window.weeklyBrandAttention[c.brandKey].push(c);
            });

            // Render the table
            const tableBody = document.getElementById('attentionTableBody');
            if (attentionList.length === 0) {
                tableBody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="icon">✅</div><h3>All creators looking good!</h3><p>No major concerns this week</p></div></td></tr>`;
            } else {
                tableBody.innerHTML = attentionList.map(c => {
                    const gmvChange = c.priorGmv > 0 ? ((c.gmv - c.priorGmv) / c.priorGmv * 100) : 0;
                    const changeClass = gmvChange >= 0 ? 'positive' : 'negative';
                    const issueLabels = {
                        'gmv_decline': 'GMV ↓',
                        'low_posting': 'Low Posts',
                        'inactive': 'Inactive',
                        'tier_risk': 'Tier Risk',
                        'disappeared': 'Gone',
                        'inconsistent': 'Irregular'
                    };
                    const issueBadges = c.issues.map(i => {
                        const badgeClass = i.severity >= 3 ? 'severe' : i.severity >= 2 ? 'warning' : 'info';
                        return `<span class="issue-badge ${badgeClass}">${issueLabels[i.type] || i.type}</span>`;
                    }).join('');

                    const consistencyIndicator = c.consistencyScore === 'inconsistent' 
                        ? '<span title="Irregular posting pattern" style="color: var(--warning);">⚡</span>' 
                        : '';

                    return `
                        <tr>
                            <td><strong>${c.name}</strong></td>
                            <td>${c.brand}</td>
                            <td>${issueBadges}</td>
                            <td>${fmtMoney(c.gmv)}</td>
                            <td>${fmtMoney(c.priorGmv)}</td>
                            <td><span class="change-indicator ${changeClass}">${gmvChange >= 0 ? '+' : ''}${gmvChange.toFixed(0)}%</span></td>
                            <td>${c.videos} ${consistencyIndicator} <span style="color: var(--text-muted); font-size: 0.75rem;">(${c.daysActive || '?'}d)</span></td>
                            <td><span class="status-badge ${c.isManaged ? 'managed' : 'unmanaged'}">${c.isManaged ? '★ Managed' : 'Unmanaged'}</span></td>
                        </tr>
                    `;
                }).join('');
            }

            // Now generate winners list
            await generateWeeklyWinners(thisWeekCreators, priorWeekCreators, startDate, endDate);
        }

        async function generateWeeklyWinners(thisWeekCreators, priorWeekCreators, startDate, endDate) {
            const winners = [];

            // Check each creator for wins
            Object.entries(thisWeekCreators).forEach(([key, data]) => {
                const prior = priorWeekCreators[key] || { gmv: 0, orders: 0, videos: 0 };
                const brandDisplay = BRAND_DISPLAY[data.brand] || data.brand;
                const achievements = [];

                const gmvGrowth = prior.gmv > 50 ? ((data.gmv - prior.gmv) / prior.gmv * 100) : 0;
                const videoGrowth = prior.videos > 0 ? ((data.videos - prior.videos) / prior.videos * 100) : 0;

                // Big GMV growth (50%+ increase with meaningful volume)
                if (gmvGrowth >= 50 && data.gmv >= 200) {
                    achievements.push({
                        type: 'growth',
                        label: '🚀 Growth',
                        message: `GMV up ${gmvGrowth.toFixed(0)}%`
                    });
                }

                // High performer (top GMV)
                if (data.gmv >= 2000) {
                    achievements.push({
                        type: 'top_performer',
                        label: '💰 Top Earner',
                        message: `${fmtMoney(data.gmv)} this week`
                    });
                }

                // Consistency king (7+ videos)
                if (data.videos >= 7) {
                    achievements.push({
                        type: 'consistent',
                        label: '🎬 Consistent',
                        message: `${data.videos} videos posted`
                    });
                }

                // Video growth (doubled or more)
                if (videoGrowth >= 100 && data.videos >= 5) {
                    achievements.push({
                        type: 'video_growth',
                        label: '📈 Posting Up',
                        message: `${prior.videos} → ${data.videos} videos`
                    });
                }

                // New star (new or was tiny, now significant)
                if ((!prior.gmv || prior.gmv < 50) && data.gmv >= 500) {
                    achievements.push({
                        type: 'new_star',
                        label: '⭐ Rising Star',
                        message: `New with ${fmtMoney(data.gmv)}`
                    });
                }

                // High conversion (good orders to videos ratio)
                if (data.videos > 0 && data.orders > 0 && (data.orders / data.videos) >= 0.5) {
                    achievements.push({
                        type: 'converter',
                        label: '🎯 High Convert',
                        message: `${(data.orders / data.videos * 100).toFixed(0)}% conversion`
                    });
                }

                if (achievements.length > 0) {
                    winners.push({
                        name: data.name,
                        brand: brandDisplay,
                        brandKey: data.brand,
                        gmv: data.gmv,
                        priorGmv: prior.gmv,
                        videos: data.videos,
                        priorVideos: prior.videos,
                        gmvGrowth,
                        achievements,
                        isManaged: isManagedForBrand(data.name, data.brand),
                        score: data.gmv + (gmvGrowth * 10) + (data.videos * 50) // Score for sorting
                    });
                }
            });

            // Sort by score (best performers first)
            winners.sort((a, b) => b.score - a.score);

            // Store globally
            window.weeklyWinners = winners;

            // Populate winners by brand
            window.weeklyBrandWinners = {};
            winners.forEach(w => {
                if (!window.weeklyBrandWinners[w.brandKey]) {
                    window.weeklyBrandWinners[w.brandKey] = [];
                }
                window.weeklyBrandWinners[w.brandKey].push(w);
            });

            // Generate copy message
            const managedWinners = winners.filter(w => w.isManaged);
            const topWinners = winners.slice(0, 20);

            let msg = `🏆 WEEKLY WINNERS - Week of ${formatDate(startDate)}

`;

            if (winners.length === 0) {
                msg += `No standout performances this week yet. Keep pushing!`;
            } else {
                msg += `🌟 TOP PERFORMERS (${winners.length} total winners)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`;
                topWinners.forEach((w, i) => {
                    const achievementText = w.achievements.map(a => a.label).join(' ');
                    msg += `${i + 1}. ${w.name} (${w.brand}) ${achievementText}
   📊 GMV: ${fmtMoney(w.gmv)} | Videos: ${w.videos} | Growth: ${w.gmvGrowth >= 0 ? '+' : ''}${w.gmvGrowth.toFixed(0)}%

`;
                });

                if (winners.length > 20) {
                    msg += `... and ${winners.length - 20} more winners!

`;
                }

                msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 SUMMARY
• Total winners: ${winners.length}
• Managed winners: ${managedWinners.length}
• Top achievement: ${getTopAchievement(winners)}`;
            }

            document.getElementById('weeklyWinnersContent').textContent = msg;

            // Render the table
            const tableBody = document.getElementById('winnersTableBody');
            if (winners.length === 0) {
                tableBody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="icon">📊</div><h3>No standout winners yet</h3><p>Check back after more data comes in</p></div></td></tr>`;
            } else {
                tableBody.innerHTML = winners.slice(0, 50).map(w => {
                    const changeClass = w.gmvGrowth >= 0 ? 'positive' : 'negative';
                    const badgeColors = {
                        'top_performer': 'gold',
                        'growth': '',
                        'consistent': 'purple',
                        'video_growth': 'blue',
                        'new_star': 'cyan',
                        'converter': 'purple'
                    };
                    const achievementBadges = w.achievements.map(a => {
                        const colorClass = badgeColors[a.type] || '';
                        return `<span class="winner-badge ${colorClass}">${a.label}</span>`;
                    }).join('');

                    return `
                        <tr>
                            <td><strong>${w.name}</strong></td>
                            <td>${w.brand}</td>
                            <td>${achievementBadges}</td>
                            <td>${fmtMoney(w.gmv)}</td>
                            <td>${fmtMoney(w.priorGmv)}</td>
                            <td><span class="change-indicator ${changeClass}">${w.gmvGrowth >= 0 ? '+' : ''}${w.gmvGrowth.toFixed(0)}%</span></td>
                            <td>${w.videos} <span style="color: var(--text-muted); font-size: 0.75rem;">(was ${w.priorVideos})</span></td>
                            <td><span class="status-badge ${w.isManaged ? 'managed' : 'unmanaged'}">${w.isManaged ? '★ Managed' : 'Unmanaged'}</span></td>
                        </tr>
                    `;
                }).join('');
            }

            // Update growing count stat and badge
            document.getElementById('weeklyGrowingCount').textContent = winners.length;
            const winnersListCount = document.getElementById('winnersListCount');
            if (winnersListCount) winnersListCount.textContent = winners.length;
        }

        function toggleWeeklyBrandComplete(brandKey, checked) {
            if (checked === undefined) {
                // Toggle mode
                if (window.completedWeeklyBrands.has(brandKey)) {
                    window.completedWeeklyBrands.delete(brandKey);
                } else {
                    window.completedWeeklyBrands.add(brandKey);
                }
            } else {
                // Explicit set mode
                if (checked) {
                    window.completedWeeklyBrands.add(brandKey);
                } else {
                    window.completedWeeklyBrands.delete(brandKey);
                }
            }
            saveCompletedWeeklyBrands();
            
            // Rebuild with stored data
            buildWeeklyBrandBoard(
                window.weeklyCreators || [], 
                window.weeklyWinners || [], 
                window.weeklyAttention || [], 
                window.weeklyBrandTotals || {}
            );
        }

        function openWeeklyBrandDetail(brandKey) {
            window.currentWeeklyBrand = brandKey;
            const brandDisplay = BRAND_DISPLAY[brandKey] || brandKey;
            const kpiData = window.brandKpiDetails?.[brandKey] || {};
            const winners = window.weeklyBrandWinners?.[brandKey] || [];
            const attention = window.weeklyBrandAttention?.[brandKey] || [];

            document.getElementById('weeklyBrandDetailName').textContent = brandDisplay;
            document.getElementById('weeklyBrandGmv').textContent = fmtMoney(kpiData.thisWeek?.gmv || 0);
            document.getElementById('weeklyBrandChange').textContent = `${kpiData.gmvChange >= 0 ? '+' : ''}${kpiData.gmvChange?.toFixed(1) || 0}%`;
            document.getElementById('weeklyBrandChange').className = `value ${kpiData.gmvChange >= 0 ? 'positive' : 'negative'}`;
            document.getElementById('weeklyBrandOrders').textContent = fmt(kpiData.thisWeek?.orders || 0);
            document.getElementById('weeklyBrandCreators').textContent = kpiData.thisWeek?.creators?.size || 0;

            // Winners
            document.getElementById('weeklyBrandWinnersCount').textContent = winners.length;
            const winnersContainer = document.getElementById('weeklyBrandWinnersContainer');
            if (winners.length === 0) {
                winnersContainer.innerHTML = '<p style="color: var(--text-muted);">No standout winners for this brand this week.</p>';
            } else {
                // Store winners for copy
                window.currentBrandWinners = winners;
                winnersContainer.innerHTML = winners.slice(0, 10).map((w, i) => `
                    <div class="winner-item" style="background: var(--bg-card); padding: 12px; border-radius: 8px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; border: 2px solid transparent; transition: all 0.2s ease;" onclick="copyWinnerShoutout(${i}, this)" title="Click to copy shoutout">
                        <div>
                            <strong>${w.name}</strong>
                            <div style="font-size: 0.8rem; color: var(--text-muted);">${w.achievements.map(a => a.label).join(' ')}</div>
                        </div>
                        <div style="text-align: right; display: flex; align-items: center; gap: 12px;">
                            <div>
                                <div style="font-weight: 700; color: var(--success);">${fmtMoney(w.gmv)}</div>
                                <div style="font-size: 0.75rem; color: var(--text-muted);">${w.gmvGrowth >= 0 ? '+' : ''}${w.gmvGrowth.toFixed(0)}%</div>
                            </div>
                            <span style="font-size: 0.8rem; color: var(--text-muted);">📋</span>
                        </div>
                    </div>
                `).join('');
            }

            // Attention
            document.getElementById('weeklyBrandAttentionCount').textContent = attention.length;
            const attentionContainer = document.getElementById('weeklyBrandAttentionContainer');
            if (attention.length === 0) {
                attentionContainer.innerHTML = '<p style="color: var(--text-muted);">All creators looking good for this brand!</p>';
            } else {
                attentionContainer.innerHTML = attention.slice(0, 10).map(c => `
                    <div style="background: var(--bg-card); padding: 12px; border-radius: 8px; margin-bottom: 8px;">
                        <div style="display: flex; justify-content: space-between;">
                            <strong>${c.name}</strong>
                            <span style="font-size: 0.8rem;">${fmtMoney(c.gmv)} <span style="color: var(--text-muted);">(was ${fmtMoney(c.priorGmv)})</span></span>
                        </div>
                        <div style="font-size: 0.8rem; color: var(--warning); margin-top: 4px;">${c.issues.map(i => i.message).join(' • ')}</div>
                    </div>
                `).join('');
            }

            // Talking Points
            const talkingPointsEl = document.getElementById('weeklyBrandTalkingPoints');
            const gmvTrend = kpiData.gmvChange >= 10 ? '📈 Strong growth' : kpiData.gmvChange <= -10 ? '📉 Declining' : '➡️ Steady';
            talkingPointsEl.innerHTML = `
                <ul style="margin: 0; padding-left: 20px; line-height: 1.8;">
                    <li><strong>GMV:</strong> ${fmtMoney(kpiData.thisWeek?.gmv || 0)} (${kpiData.gmvChange >= 0 ? '+' : ''}${kpiData.gmvChange?.toFixed(1) || 0}% WoW) ${gmvTrend}</li>
                    <li><strong>Active Creators:</strong> ${kpiData.thisWeek?.creators?.size || 0}</li>
                    <li><strong>Top Performer:</strong> ${kpiData.topCreators?.[0]?.name || 'N/A'} - ${fmtMoney(kpiData.topCreators?.[0]?.gmv || 0)}</li>
                    <li><strong>Wins to celebrate:</strong> ${winners.length} creators crushing it</li>
                    <li><strong>Need follow-up:</strong> ${attention.length} creators ${attention.length > 0 ? '- recommend outreach' : ''}</li>
                </ul>
            `;

            document.getElementById('weeklyBrandDetail').style.display = 'block';
            document.getElementById('weeklyBrandBoard').parentElement.parentElement.style.display = 'none';
        }

        function closeWeeklyBrandDetail() {
            document.getElementById('weeklyBrandDetail').style.display = 'none';
            document.getElementById('weeklyBrandBoard').parentElement.parentElement.style.display = 'block';
        }

        function markWeeklyBrandComplete() {
            if (window.currentWeeklyBrand) {
                window.completedWeeklyBrands.add(window.currentWeeklyBrand);
                saveCompletedWeeklyBrands();
                closeWeeklyBrandDetail();
                buildWeeklyBrandBoard();
            }
        }

        function copyWeeklyBrandReport() {
            if (window.currentWeeklyBrand && window.brandKpiReports?.[window.currentWeeklyBrand]) {
                navigator.clipboard.writeText(window.brandKpiReports[window.currentWeeklyBrand]);
            }
        }

        function copyWinnerShoutout(index, element) {
            const winners = window.currentBrandWinners || [];
            const w = winners[index];
            if (!w) return;

            const brandDisplay = BRAND_DISPLAY[window.currentWeeklyBrand] || window.currentWeeklyBrand;
            const achievementText = w.achievements.map(a => a.label).join(' ');
            
            const shoutout = `🏆 WEEKLY WINNER SHOUTOUT!

Big congratulations to @${w.name} for an incredible week with ${brandDisplay}! ${achievementText}

📊 Stats:
• GMV: ${fmtMoney(w.gmv)} (+${w.gmvGrowth.toFixed(0)}% growth!)
• Videos: ${w.videos}

Keep crushing it! 🔥`;

            navigator.clipboard.writeText(shoutout).then(() => {
                element.style.borderColor = 'var(--success)';
                element.style.background = 'var(--success-dim)';
                setTimeout(() => {
                    element.style.borderColor = 'transparent';
                    element.style.background = 'var(--bg-card)';
                }, 1500);
            });
        }

        function getTopAchievement(winners) {
            const counts = {};
            winners.forEach(w => {
                w.achievements.forEach(a => {
                    counts[a.type] = (counts[a.type] || 0) + 1;
                });
            });
            const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
            if (sorted.length === 0) return 'None';
            const typeLabels = {
                'growth': 'GMV Growth',
                'top_performer': 'Top Earners',
                'consistent': 'Consistency',
                'video_growth': 'Posting Growth',
                'new_star': 'Rising Stars',
                'converter': 'High Converters'
            };
            return typeLabels[sorted[0][0]] || sorted[0][0];
        }

        function toggleWinnersView() {
            const tableView = document.getElementById('winnersTableView');
            const copyView = document.getElementById('winnersCopyView');
            const toggleBtn = document.getElementById('winnersViewToggle');

            if (tableView.style.display === 'none') {
                tableView.style.display = 'block';
                copyView.style.display = 'none';
                toggleBtn.textContent = '📋 Show Copy Version';
            } else {
                tableView.style.display = 'none';
                copyView.style.display = 'block';
                toggleBtn.textContent = '📊 Show Table View';
            }
        }

        function toggleAttentionView() {
            const tableView = document.getElementById('attentionTableView');
            const copyView = document.getElementById('attentionCopyView');
            const toggleBtn = document.getElementById('attentionViewToggle');

            if (tableView.style.display === 'none') {
                tableView.style.display = 'block';
                copyView.style.display = 'none';
                toggleBtn.textContent = '📋 Show Copy Version';
            } else {
                tableView.style.display = 'none';
                copyView.style.display = 'block';
                toggleBtn.textContent = '📊 Show Table View';
            }
        }

        function getMostCommonIssue(list) {
            const counts = {};
            list.forEach(c => {
                c.issues.forEach(i => {
                    counts[i.type] = (counts[i.type] || 0) + 1;
                });
            });
            const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
            if (sorted.length === 0) return 'None';
            const typeLabels = {
                'gmv_decline': 'GMV decline',
                'low_posting': 'Low posting',
                'inactive': 'Inactive',
                'tier_risk': 'Tier risk',
                'disappeared': 'Disappeared',
                'inconsistent': 'Inconsistent posting'
            };
            return typeLabels[sorted[0][0]] || sorted[0][0];
        }

        async function generateBrandKpiReports(thisWeekData, priorWeekData, startDate, endDate, brandFilter) {
            // Aggregate by brand for this week
            const thisWeekBrands = {};
            const thisWeekCreatorGrowth = {}; // Track creator growth for stats
            
            thisWeekData.forEach(row => {
                if (!thisWeekBrands[row.brand]) {
                    thisWeekBrands[row.brand] = { 
                        gmv: 0, orders: 0, videos: 0, commission: 0,
                        creators: new Set(),
                        creatorData: {}
                    };
                }
                thisWeekBrands[row.brand].gmv += pFloat(row.gmv);
                thisWeekBrands[row.brand].orders += pInt(row.orders);
                thisWeekBrands[row.brand].videos += pInt(row.videos);
                thisWeekBrands[row.brand].commission += pFloat(row.est_commission);
                thisWeekBrands[row.brand].creators.add(row.creator_name);

                // Track individual creator performance
                if (!thisWeekBrands[row.brand].creatorData[row.creator_name]) {
                    thisWeekBrands[row.brand].creatorData[row.creator_name] = { gmv: 0, videos: 0, orders: 0 };
                }
                thisWeekBrands[row.brand].creatorData[row.creator_name].gmv += pFloat(row.gmv);
                thisWeekBrands[row.brand].creatorData[row.creator_name].videos += pInt(row.videos);
                thisWeekBrands[row.brand].creatorData[row.creator_name].orders += pInt(row.orders);

                // Track all creators for growth calculation
                const key = `${row.creator_name}|||${row.brand}`;
                if (!thisWeekCreatorGrowth[key]) thisWeekCreatorGrowth[key] = { gmv: 0 };
                thisWeekCreatorGrowth[key].gmv += pFloat(row.gmv);
            });

            // Aggregate by brand for prior week
            const priorWeekBrands = {};
            const priorWeekCreatorGrowth = {};
            
            priorWeekData.forEach(row => {
                if (!priorWeekBrands[row.brand]) {
                    priorWeekBrands[row.brand] = { gmv: 0, orders: 0, videos: 0, creatorData: {} };
                }
                priorWeekBrands[row.brand].gmv += pFloat(row.gmv);
                priorWeekBrands[row.brand].orders += pInt(row.orders);
                priorWeekBrands[row.brand].videos += pInt(row.videos);

                // Track individual creator for prior week
                if (!priorWeekBrands[row.brand].creatorData[row.creator_name]) {
                    priorWeekBrands[row.brand].creatorData[row.creator_name] = { gmv: 0, videos: 0 };
                }
                priorWeekBrands[row.brand].creatorData[row.creator_name].gmv += pFloat(row.gmv);
                priorWeekBrands[row.brand].creatorData[row.creator_name].videos += pInt(row.videos);

                // Track for growth calculation
                const key = `${row.creator_name}|||${row.brand}`;
                if (!priorWeekCreatorGrowth[key]) priorWeekCreatorGrowth[key] = { gmv: 0 };
                priorWeekCreatorGrowth[key].gmv += pFloat(row.gmv);
            });

            // Calculate growing creators (10%+ growth)
            let growingCount = 0;
            Object.entries(thisWeekCreatorGrowth).forEach(([key, data]) => {
                const prior = priorWeekCreatorGrowth[key];
                if (prior && prior.gmv > 50) { // Only count if had meaningful GMV before
                    const growth = (data.gmv - prior.gmv) / prior.gmv;
                    if (growth >= 0.1) growingCount++;
                }
            });

            // Calculate totals for weekly stats
            let totalGmv = 0, totalVideos = 0, priorTotalGmv = 0, priorTotalVideos = 0;
            Object.values(thisWeekBrands).forEach(b => {
                totalGmv += b.gmv;
                totalVideos += b.videos;
            });
            Object.values(priorWeekBrands).forEach(b => {
                priorTotalGmv += b.gmv;
                priorTotalVideos += b.videos;
            });

            const gmvChangeTotal = priorTotalGmv > 0 ? ((totalGmv - priorTotalGmv) / priorTotalGmv * 100) : 0;
            const videosChangeTotal = priorTotalVideos > 0 ? ((totalVideos - priorTotalVideos) / priorTotalVideos * 100) : 0;

            // Update weekly stats
            document.getElementById('weeklyTotalGmv').textContent = fmtMoney(totalGmv);
            document.getElementById('weeklyGmvChange').textContent = `${gmvChangeTotal >= 0 ? '+' : ''}${gmvChangeTotal.toFixed(1)}% WoW`;
            document.getElementById('weeklyGmvChange').className = `stat-change ${gmvChangeTotal >= 0 ? 'positive' : 'negative'}`;
            document.getElementById('weeklyGrowingCount').textContent = growingCount;
            document.getElementById('weeklyTotalVideos').textContent = fmt(totalVideos);
            document.getElementById('weeklyVideosChange').textContent = `${videosChangeTotal >= 0 ? '+' : ''}${videosChangeTotal.toFixed(1)}% WoW`;
            document.getElementById('weeklyVideosChange').className = `stat-change ${videosChangeTotal >= 0 ? 'positive' : 'negative'}`;

            // Store reports for click-to-copy and detail view
            window.brandKpiReports = {};
            window.brandKpiDetails = {};
            window.weeklyDateRange = { startDate, endDate };

            const brands = ['catakor', 'jiyu', 'physicians_choice', 'peach_slices', 'yerba_magic'];
            const container = document.getElementById('brandKpiContainer');
            
            let html = '<div class="brand-kpi-grid">';

            brands.forEach(brandKey => {
                const brandDisplay = BRAND_DISPLAY[brandKey] || brandKey;
                const thisWeek = thisWeekBrands[brandKey] || { gmv: 0, orders: 0, videos: 0, commission: 0, creators: new Set(), creatorData: {} };
                const priorWeek = priorWeekBrands[brandKey] || { gmv: 0, orders: 0, videos: 0, creatorData: {} };

                // Calculate changes
                const gmvChange = priorWeek.gmv > 0 ? ((thisWeek.gmv - priorWeek.gmv) / priorWeek.gmv * 100) : 0;
                const ordersChange = priorWeek.orders > 0 ? ((thisWeek.orders - priorWeek.orders) / priorWeek.orders * 100) : 0;
                const videosChange = priorWeek.videos > 0 ? ((thisWeek.videos - priorWeek.videos) / priorWeek.videos * 100) : 0;

                const aov = thisWeek.orders > 0 ? thisWeek.gmv / thisWeek.orders : 0;
                const gmvPerVideo = thisWeek.videos > 0 ? thisWeek.gmv / thisWeek.videos : 0;

                // All creators for this brand with their data
                const allCreators = Object.entries(thisWeek.creatorData)
                    .map(([name, data]) => {
                        const prior = priorWeek.creatorData?.[name] || { gmv: 0, videos: 0 };
                        const creatorGmvChange = prior.gmv > 0 ? ((data.gmv - prior.gmv) / prior.gmv * 100) : 0;
                        return { 
                            name, 
                            ...data, 
                            priorGmv: prior.gmv,
                            priorVideos: prior.videos,
                            gmvChange: creatorGmvChange,
                            isManaged: isManagedForBrand(name, brandKey)
                        };
                    })
                    .sort((a, b) => b.gmv - a.gmv);

                // Top 5 creators for this brand
                const topCreators = allCreators.slice(0, 5);

                // Store detail data
                window.brandKpiDetails[brandKey] = {
                    brandDisplay,
                    thisWeek,
                    priorWeek,
                    gmvChange,
                    ordersChange,
                    videosChange,
                    aov,
                    gmvPerVideo,
                    topCreators,
                    allCreators
                };

                // Generate report text
                const report = `📊 ${brandDisplay.toUpperCase()} - WEEKLY KPI REPORT
Week: ${formatDate(startDate)} → ${formatDate(endDate)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💰 GMV: ${fmtMoney(thisWeek.gmv)} (${gmvChange >= 0 ? '+' : ''}${gmvChange.toFixed(1)}% WoW)
📦 Orders: ${fmt(thisWeek.orders)} (${ordersChange >= 0 ? '+' : ''}${ordersChange.toFixed(1)}% WoW)
🎬 Videos: ${fmt(thisWeek.videos)} (${videosChange >= 0 ? '+' : ''}${videosChange.toFixed(1)}% WoW)
👥 Active Creators: ${thisWeek.creators.size}

📈 KEY METRICS
• AOV: ${fmtMoney(aov)}
• GMV per Video: ${fmtMoney(gmvPerVideo)}
• Est. Commission: ${fmtMoney(thisWeek.commission)}

🏆 TOP 5 CREATORS
${topCreators.map((c, i) => `${i + 1}. ${c.name} - ${fmtMoney(c.gmv)} (${c.videos} videos)`).join('\n')}

${gmvChange >= 10 ? '✅ Strong week! GMV up significantly.' : gmvChange <= -10 ? '⚠️ GMV declined this week - may need attention.' : '📊 Steady performance this week.'}
`;

                window.brandKpiReports[brandKey] = report;

                // Generate card HTML
                const changeClass = gmvChange >= 0 ? 'positive' : 'negative';
                const changeIcon = gmvChange >= 0 ? '📈' : '📉';

                html += `
                <div class="brand-kpi-card" data-brand="${brandKey}" onclick="showBrandDetail('${brandKey}')">
                    <button class="quick-copy-btn" onclick="event.stopPropagation(); quickCopyBrandReport('${brandKey}', this)">📋 Copy</button>
                    <div class="brand-kpi-header">
                        <span class="brand-kpi-name">${brandDisplay}</span>
                        <span class="brand-kpi-change ${changeClass}">${changeIcon} ${gmvChange >= 0 ? '+' : ''}${gmvChange.toFixed(1)}%</span>
                    </div>
                    <div class="brand-kpi-gmv">${fmtMoney(thisWeek.gmv)}</div>
                    <div class="brand-kpi-stats">
                        <div><span class="label">Orders</span><span class="value">${fmt(thisWeek.orders)}</span></div>
                        <div><span class="label">Videos</span><span class="value">${fmt(thisWeek.videos)}</span></div>
                        <div><span class="label">Creators</span><span class="value">${thisWeek.creators.size}</span></div>
                    </div>
                    <div class="brand-kpi-hint">Click for details</div>
                </div>
                `;
            });

            html += '</div>';
            container.innerHTML = html;
        }

        function quickCopyBrandReport(brandKey, btn) {
            const report = window.brandKpiReports[brandKey];
            if (!report) return;

            navigator.clipboard.writeText(report).then(() => {
                btn.classList.add('copied');
                btn.textContent = '✅ Copied';
                setTimeout(() => {
                    btn.classList.remove('copied');
                    btn.textContent = '📋 Copy';
                }, 2000);
            });
        }

        let currentBrandDetail = null;

        function showBrandDetail(brandKey) {
            const overview = document.getElementById('brandKpiOverview');
            const detail = document.getElementById('brandKpiDetail');
            const select = document.getElementById('brandKpiSelect');

            if (brandKey === 'overview') {
                overview.style.display = 'block';
                detail.style.display = 'none';
                select.value = 'overview';
                currentBrandDetail = null;
                return;
            }

            const data = window.brandKpiDetails[brandKey];
            if (!data) return;

            currentBrandDetail = brandKey;
            select.value = brandKey;

            const { brandDisplay, thisWeek, priorWeek, gmvChange, ordersChange, videosChange, aov, gmvPerVideo, allCreators } = data;
            const dateRange = window.weeklyDateRange;

            const changeClass = gmvChange >= 0 ? 'positive' : 'negative';

            let html = `
                <div class="brand-detail-header">
                    <div>
                        <div class="brand-detail-title">${brandDisplay}</div>
                        <div class="brand-detail-subtitle">Week of ${formatDate(dateRange.startDate)} → ${formatDate(dateRange.endDate)}</div>
                    </div>
                    <div class="brand-detail-gmv">
                        <div class="value">${fmtMoney(thisWeek.gmv)}</div>
                        <div class="change ${changeClass}">${gmvChange >= 0 ? '↑' : '↓'} ${Math.abs(gmvChange).toFixed(1)}% vs last week</div>
                    </div>
                </div>

                <div class="brand-metrics-grid">
                    <div class="brand-metric-card">
                        <div class="value">${fmt(thisWeek.orders)}</div>
                        <div class="label">Orders</div>
                        <div class="change ${ordersChange >= 0 ? 'positive' : 'negative'}">${ordersChange >= 0 ? '+' : ''}${ordersChange.toFixed(1)}%</div>
                    </div>
                    <div class="brand-metric-card">
                        <div class="value">${fmt(thisWeek.videos)}</div>
                        <div class="label">Videos</div>
                        <div class="change ${videosChange >= 0 ? 'positive' : 'negative'}">${videosChange >= 0 ? '+' : ''}${videosChange.toFixed(1)}%</div>
                    </div>
                    <div class="brand-metric-card">
                        <div class="value">${fmtMoney(aov)}</div>
                        <div class="label">AOV</div>
                        <div class="change neutral">Avg Order Value</div>
                    </div>
                    <div class="brand-metric-card">
                        <div class="value">${fmtMoney(gmvPerVideo)}</div>
                        <div class="label">GMV/Video</div>
                        <div class="change neutral">Efficiency</div>
                    </div>
                </div>

                <div class="card" style="margin-bottom: 0;">
                    <div class="card-header">
                        <div class="card-title"><span>👥</span> All Creators (${allCreators.length})</div>
                    </div>
                    <div class="card-body no-padding">
                        <div class="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Creator</th>
                                        <th>GMV</th>
                                        <th>Prior Week</th>
                                        <th>Change</th>
                                        <th>Videos</th>
                                        <th>Orders</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${allCreators.slice(0, 50).map((c, i) => {
                                        const cChangeClass = c.gmvChange >= 0 ? 'positive' : 'negative';
                                        return `
                                            <tr>
                                                <td>${i + 1}</td>
                                                <td><strong>${c.name}</strong></td>
                                                <td>${fmtMoney(c.gmv)}</td>
                                                <td>${fmtMoney(c.priorGmv)}</td>
                                                <td><span class="change-indicator ${cChangeClass}">${c.gmvChange >= 0 ? '+' : ''}${c.gmvChange.toFixed(0)}%</span></td>
                                                <td>${c.videos}</td>
                                                <td>${c.orders}</td>
                                                <td><span class="status-badge ${c.isManaged ? 'managed' : 'unmanaged'}">${c.isManaged ? '★' : '-'}</span></td>
                                            </tr>
                                        `;
                                    }).join('')}
                                    ${allCreators.length > 50 ? `<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">... and ${allCreators.length - 50} more creators</td></tr>` : ''}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;

            document.getElementById('brandDetailContent').innerHTML = html;
            overview.style.display = 'none';
            detail.style.display = 'block';
        }

        function copyCurrentBrandReport() {
            if (!currentBrandDetail) return;
            const report = window.brandKpiReports[currentBrandDetail];
            if (!report) return;

            navigator.clipboard.writeText(report).then(() => {
                const btn = event.target;
                btn.textContent = '✅ Copied!';
                setTimeout(() => {
                    btn.textContent = '📋 Copy Report';
                }, 2000);
            });
        }

