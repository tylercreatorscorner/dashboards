// ==================== VIEWS ====================
        // ==================== DECISIONS TAB BRAND FILTER ====================
        function onDecisionsBrandFilterChange() {
            loadProductsForFilter('decisionsProductFilter', document.getElementById('decisionsBrandFilter').value);
            loadDecisions();
        }
        
        // ==================== LOAD PRODUCTS FOR FILTER ====================
        async function loadProductsForFilter(selectId, brand) {
            const select = document.getElementById(selectId);
            if (!select) return;
            
            select.innerHTML = '<option value="all">All Products</option>';
            
            if (brand === 'all') return;
            
            try {
                const { data: products } = await supabaseClient.from('products')
                    .select('product_key, display_name')
                    .eq('brand', brand);
                
                (products || []).forEach(p => {
                    const option = document.createElement('option');
                    option.value = p.product_key;
                    option.textContent = p.display_name;
                    select.appendChild(option);
                });
            } catch (err) {
                console.error('Error loading products:', err);
            }
        }
        
        // Load ALL active products into a filter dropdown (for cross-brand views)
        async function loadAllProductsForFilter(selectId) {
            const select = document.getElementById(selectId);
            if (!select) return;
            
            select.innerHTML = '<option value="all">All Products</option>';
            
            try {
                const { data: products } = await supabaseClient.from('products')
                    .select('product_key, display_name, brand')
                    .eq('status', 'active')
                    .order('brand')
                    .order('display_name');
                
                (products || []).forEach(p => {
                    const option = document.createElement('option');
                    option.value = p.product_key;
                    option.textContent = `${p.display_name} (${BRAND_DISPLAY[p.brand] || p.brand})`;
                    select.appendChild(option);
                });
            } catch (err) {
                console.error('Error loading all products:', err);
            }
        }
        
        function filterByQuadrant(quadrant) {
            opsData.currentQuadrant = quadrant;
            
            // Update quadrant styling
            document.querySelectorAll('.health-quadrant').forEach(q => {
                q.style.opacity = (quadrant === 'all' || q.dataset.quadrant === quadrant) ? '1' : '0.4';
                q.style.transform = q.dataset.quadrant === quadrant ? 'scale(1.02)' : 'scale(1)';
            });
            
            // Filter creators
            let filtered = opsData.creators;
            if (quadrant !== 'all') {
                filtered = opsData.creators.filter(c => c.quadrant === quadrant);
            }
            
            // Sort by GMV descending
            filtered.sort((a, b) => b.gmv - a.gmv);
            
            // Update title
            const titles = {
                all: { icon: '👥', text: 'All Creators' },
                stars: { icon: '🌟', text: 'Stars — Posting + Converting' },
                grinding: { icon: '🎬', text: 'Grinding — High Output, Low GMV' },
                coasting: { icon: '⚡', text: 'Coasting — High GMV, Low Output' },
                dormant: { icon: '😴', text: 'Dormant — Need Outreach' }
            };
            
            const titleInfo = titles[quadrant] || titles.all;
            document.getElementById('filteredListIcon').textContent = titleInfo.icon;
            document.getElementById('filteredListTitle').textContent = titleInfo.text;
            document.getElementById('filteredListCount').textContent = filtered.length;
            
            // Render table
            const tbody = document.getElementById('filteredCreatorList');
            if (filtered.length === 0) {
                tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 40px; color: var(--text-muted);">No creators in this category</td></tr>`;
                return;
            }
            
            tbody.innerHTML = filtered.map(c => {
                const statusColor = {
                    stars: 'var(--success)',
                    grinding: 'var(--blue)',
                    coasting: 'var(--warning)',
                    dormant: 'var(--error)'
                }[c.quadrant];
                
                const statusIcon = {
                    stars: '🌟',
                    grinding: '🎬',
                    coasting: '⚡',
                    dormant: '😴'
                }[c.quadrant];
                
                // Trend arrow
                let trendHtml = '<span style="color: var(--text-muted);">—</span>';
                if (c.gmvChange > 10) {
                    trendHtml = `<span style="color: var(--success);">↑ ${c.gmvChange.toFixed(0)}%</span>`;
                } else if (c.gmvChange < -10) {
                    trendHtml = `<span style="color: var(--error);">↓ ${Math.abs(c.gmvChange).toFixed(0)}%</span>`;
                } else if (c.gmvChange !== 0) {
                    trendHtml = `<span style="color: var(--text-muted);">→ ${c.gmvChange > 0 ? '+' : ''}${c.gmvChange.toFixed(0)}%</span>`;
                }
                
                // Last contact
                let lastContactHtml = '<span style="color: var(--text-muted);">Never</span>';
                if (c.lastContact) {
                    const contactDate = new Date(c.lastContact);
                    const daysSince = Math.floor((new Date() - contactDate) / (1000 * 60 * 60 * 24));
                    if (daysSince === 0) {
                        lastContactHtml = '<span style="color: var(--success);">Today</span>';
                    } else if (daysSince === 1) {
                        lastContactHtml = '<span style="color: var(--success);">Yesterday</span>';
                    } else if (daysSince <= 7) {
                        lastContactHtml = `<span style="color: var(--text-secondary);">${daysSince}d ago</span>`;
                    } else if (daysSince <= 14) {
                        lastContactHtml = `<span style="color: var(--warning);">${daysSince}d ago</span>`;
                    } else {
                        lastContactHtml = `<span style="color: var(--error);">${daysSince}d ago</span>`;
                    }
                }
                
                return `
                    <tr style="cursor: pointer;" onclick="openCreatorDetail('${c.creator_name}', '${c.brand}')">
                        <td>
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <div style="width: 36px; height: 36px; border-radius: 50%; background: var(--accent-dim); display: flex; align-items: center; justify-content: center; font-weight: 600; color: var(--accent);">
                                    ${(c.creator_name || '?')[0].toUpperCase()}
                                </div>
                                <div>
                                    <div style="font-weight: 600;">@${c.creator_name}</div>
                                    ${c.managed ? '<span style="font-size: 0.7rem; color: var(--success);">✓ Managed</span>' : ''}
                                </div>
                            </div>
                        </td>
                        <td>
                            <span style="padding: 4px 8px; background: var(--accent-dim); border-radius: 4px; font-size: 0.8rem;">
                                ${BRAND_ICONS[c.brand] || '🏷️'} ${BRAND_DISPLAY[c.brand] || c.brand}
                            </span>
                        </td>
                        <td style="text-align: center; font-weight: 600;">${c.videos}</td>
                        <td style="text-align: right; font-weight: 600; color: var(--success);">${fmtMoney(c.gmv)}</td>
                        <td style="text-align: center; font-size: 0.85rem;">${trendHtml}</td>
                        <td style="text-align: center; font-size: 0.85rem;">${lastContactHtml}</td>
                        <td style="text-align: center;">
                            <span style="padding: 4px 10px; background: ${statusColor}22; color: ${statusColor}; border-radius: 12px; font-size: 0.8rem; font-weight: 500;">
                                ${statusIcon} ${c.quadrant.charAt(0).toUpperCase() + c.quadrant.slice(1)}
                            </span>
                        </td>
                        <td style="text-align: center; position: relative;" onclick="event.stopPropagation();">
                            <div class="quick-action-wrapper" style="position: relative; display: inline-block;">
                                <button class="btn btn-small" onclick="toggleQuickActionMenu(this, '${c.creator_name}', '${c.brand}')" title="Quick actions">⚡</button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        }
        
        // Quick Action Menu
        let activeQuickActionMenu = null;
        
        function toggleQuickActionMenu(btn, creatorName, brand) {
            // Close any existing menu
            closeQuickActionMenu();
            
            const wrapper = btn.parentElement;
            const menu = document.createElement('div');
            menu.className = 'quick-action-menu';
            menu.style.cssText = `
                position: absolute;
                top: 100%;
                right: 0;
                background: var(--bg-card);
                border: 1px solid var(--border);
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: 1000;
                min-width: 180px;
                padding: 4px 0;
            `;
            
            menu.innerHTML = `
                <div class="quick-action-item" onclick="copyDmTemplate('${creatorName}', '${brand}')" style="padding: 10px 14px; cursor: pointer; display: flex; align-items: center; gap: 10px; font-size: 0.85rem;">
                    <span>📋</span> Copy DM Template
                </div>
                <div class="quick-action-item" onclick="openDiscordChatForCreator('${creatorName}', '${brand}')" style="padding: 10px 14px; cursor: pointer; display: flex; align-items: center; gap: 10px; font-size: 0.85rem;">
                    <span style="color: #5865F2;">💬</span> Open Discord Chat
                </div>
                <div class="quick-action-item" onclick="markContactedToday('${creatorName}', '${brand}')" style="padding: 10px 14px; cursor: pointer; display: flex; align-items: center; gap: 10px; font-size: 0.85rem;">
                    <span>✅</span> Mark Contacted Today
                </div>
                <div class="quick-action-item" onclick="scheduleFollowup('${creatorName}', '${brand}')" style="padding: 10px 14px; cursor: pointer; display: flex; align-items: center; gap: 10px; font-size: 0.85rem;">
                    <span>📅</span> Schedule Follow-up
                </div>
                <div class="quick-action-item" onclick="addQuickNote('${creatorName}', '${brand}')" style="padding: 10px 14px; cursor: pointer; display: flex; align-items: center; gap: 10px; font-size: 0.85rem;">
                    <span>📝</span> Add Note
                </div>
                <div style="border-top: 1px solid var(--border); margin: 4px 0;"></div>
                <div class="quick-action-item" onclick="openCreatorDetail('${creatorName}', '${brand}')" style="padding: 10px 14px; cursor: pointer; display: flex; align-items: center; gap: 10px; font-size: 0.85rem;">
                    <span>👤</span> View Full Profile
                </div>
            `;
            
            // Add hover styles
            menu.querySelectorAll('.quick-action-item').forEach(item => {
                item.addEventListener('mouseenter', () => item.style.background = 'var(--bg-secondary)');
                item.addEventListener('mouseleave', () => item.style.background = 'transparent');
            });
            
            wrapper.appendChild(menu);
            activeQuickActionMenu = menu;
            
            // Close on outside click
            setTimeout(() => {
                document.addEventListener('click', closeQuickActionMenu, { once: true });
            }, 10);
        }
        
        function closeQuickActionMenu() {
            if (activeQuickActionMenu) {
                activeQuickActionMenu.remove();
                activeQuickActionMenu = null;
            }
        }
        
        function copyDmTemplate(creatorName, brand) {
            closeQuickActionMenu();
            const creator = opsData.creators.find(c => c.creator_name === creatorName && c.brand === brand);
            
            let template = '';
            if (creator?.quadrant === 'stars') {
                template = `Hey @${creatorName}! 🌟 You've been crushing it lately! Wanted to reach out and say thanks for all the amazing content. Your videos are really resonating. Keep it up! 🔥`;
            } else if (creator?.quadrant === 'grinding') {
                template = `Hey @${creatorName}! 🎬 Love seeing you stay consistent with the content! I've got a few tips that might help boost conversions. Got a min to chat?`;
            } else if (creator?.quadrant === 'coasting') {
                template = `Hey @${creatorName}! ⚡ Your content always performs well. Any chance you could drop a few more videos this week? Your audience is loving what you put out!`;
            } else {
                template = `Hey @${creatorName}! 👋 Haven't seen you around lately — everything okay? We'd love to have you back creating. Let me know if you need anything!`;
            }
            
            navigator.clipboard.writeText(template).then(() => {
                showToast('DM template copied!', 'success');
            });
        }
        
        async function markContactedToday(creatorName, brand) {
            closeQuickActionMenu();
            
            try {
                const today = new Date().toISOString().split('T')[0];
                
                // Find the managed creator entry
                const mc = managedCreators.find(m => {
                    const accounts = [m.account_1, m.account_2, m.account_3, m.account_4, m.account_5].filter(Boolean).map(a => a.toLowerCase());
                    return accounts.includes(creatorName.toLowerCase()) && m.brand === brand;
                });
                
                if (mc) {
                    await supabaseClient
                        .from('managed_creators')
                        .update({ last_contact_date: today })
                        .eq('id', mc.id);
                    
                    showToast(`Marked @${creatorName} as contacted today!`, 'success');
                    
                    // Refresh data
                    await loadManagedCreators();
                    reloadCurrentOpsTab();
                } else {
                    showToast('Creator not found in roster', 'error');
                }
            } catch (err) {
                console.error('Failed to mark contacted:', err);
                showToast('Failed to update: ' + err.message, 'error');
            }
        }
        
        function scheduleFollowup(creatorName, brand) {
            closeQuickActionMenu();
            // For now, prompt for date
            const date = prompt(`Schedule follow-up for @${creatorName}:\nEnter date (YYYY-MM-DD):`);
            if (!date) return;
            
            // Validate date format
            if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
                showToast('Invalid date format. Use YYYY-MM-DD', 'error');
                return;
            }
            
            // Find and update
            const mc = managedCreators.find(m => {
                const accounts = [m.account_1, m.account_2, m.account_3, m.account_4, m.account_5].filter(Boolean).map(a => a.toLowerCase());
                return accounts.includes(creatorName.toLowerCase()) && m.brand === brand;
            });
            
            if (mc) {
                supabaseClient
                    .from('managed_creators')
                    .update({ next_followup_date: date })
                    .eq('id', mc.id)
                    .then(() => {
                        showToast(`Follow-up scheduled for ${date}`, 'success');
                        loadManagedCreators();
                    });
            } else {
                showToast('Creator not found in roster', 'error');
            }
        }
        
        function addQuickNote(creatorName, brand) {
            closeQuickActionMenu();
            const note = prompt(`Add note for @${creatorName}:`);
            if (!note) return;
            
            // Find and update
            const mc = managedCreators.find(m => {
                const accounts = [m.account_1, m.account_2, m.account_3, m.account_4, m.account_5].filter(Boolean).map(a => a.toLowerCase());
                return accounts.includes(creatorName.toLowerCase()) && m.brand === brand;
            });
            
            if (mc) {
                const timestamp = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                const newNote = `[${timestamp}] ${note}`;
                const existingNotes = mc.notes || '';
                const updatedNotes = existingNotes ? `${newNote}\n${existingNotes}` : newNote;
                
                supabaseClient
                    .from('managed_creators')
                    .update({ notes: updatedNotes })
                    .eq('id', mc.id)
                    .then(() => {
                        showToast('Note added!', 'success');
                        loadManagedCreators();
                    });
            } else {
                showToast('Creator not found in roster', 'error');
            }
        }
        
        function openQuickAction(creatorName, brand) {
            // Legacy function - now uses dropdown
            openCreatorDetail(creatorName, brand);
        }
        
        async function loadVideoIntel(startStr, endStr, brand, managedOnly) {
            // Fetch video performance data
            let videoQuery = supabaseClient
                .from('video_performance')
                .select('video_id, video_title, creator_name, brand, gmv, orders, product_name')
                .gte('report_date', startStr)
                .lte('report_date', endStr);
            
            if (brand !== 'all') videoQuery = videoQuery.eq('brand', brand);
            
            const { data: videoPerf } = await videoQuery;
            
            // Aggregate video data
            const videoMap = new Map();
            (videoPerf || []).forEach(row => {
                if (!row.video_id) return;
                
                const managed = isManagedForBrand(row.creator_name, row.brand);
                if (managedOnly && !managed) return;
                
                if (!videoMap.has(row.video_id)) {
                    videoMap.set(row.video_id, {
                        video_id: row.video_id,
                        video_title: row.video_title,
                        creator_name: row.creator_name,
                        brand: row.brand,
                        gmv: 0,
                        orders: 0,
                        managed
                    });
                }
                const v = videoMap.get(row.video_id);
                v.gmv += pFloat(row.gmv);
                v.orders += pInt(row.orders);
            });
            
            const videos = [...videoMap.values()];
            opsData.videos = videos;
            
            // Calculate stats
            const totalVideos = videos.length;
            const totalVideoGmv = videos.reduce((s, v) => s + v.gmv, 0);
            const avgGmvPerVideo = totalVideos > 0 ? totalVideoGmv / totalVideos : 0;
            const hotVideos = videos.filter(v => v.gmv >= 100).length;
            
            document.getElementById('opsTotalVideos').textContent = totalVideos.toLocaleString();
            document.getElementById('opsTotalVideoGmv').textContent = fmtMoney(totalVideoGmv);
            document.getElementById('opsAvgGmvPerVideo').textContent = fmtMoney(avgGmvPerVideo);
            document.getElementById('opsHotVideoCount').textContent = hotVideos;
            
            // Hot Videos (top 10 by GMV)
            const hotVideosList = [...videos].sort((a, b) => b.gmv - a.gmv).slice(0, 10);
            document.getElementById('hotVideosList').innerHTML = hotVideosList.length === 0 
                ? '<tr><td colspan="7" style="text-align: center; padding: 40px; color: var(--text-muted);">No videos found</td></tr>'
                : hotVideosList.map((v, i) => `
                    <tr>
                        <td style="text-align: center; color: ${i < 3 ? 'var(--warning)' : 'var(--text-muted)'}; font-weight: 600;">${i + 1}</td>
                        <td>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="cursor: pointer; color: var(--accent);" onclick="openVideoEmbed('${v.video_id}', '${(v.video_title || '').replace(/'/g, "\\'")}', ${v.gmv}, ${v.orders}, '${v.creator_name}')">▶</span>
                                <span style="max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${v.video_title || 'Untitled'}">${v.video_title || 'Untitled'}</span>
                            </div>
                        </td>
                        <td>@${v.creator_name}</td>
                        <td><span style="padding: 2px 6px; background: var(--accent-dim); border-radius: 4px; font-size: 0.75rem;">${BRAND_ICONS[v.brand] || ''} ${BRAND_DISPLAY[v.brand] || v.brand}</span></td>
                        <td style="text-align: right; font-weight: 600; color: var(--success);">${fmtMoney(v.gmv)}</td>
                        <td style="text-align: right;">${v.orders}</td>
                        <td style="text-align: center;">
                            <button class="btn btn-small" onclick="copyVideoUrl('${v.video_id}', '${v.creator_name}')" title="Copy URL">📋</button>
                        </td>
                    </tr>
                `).join('');
            
            // Video Velocity (GMV per video by creator)
            const creatorVelocity = new Map();
            videos.forEach(v => {
                const key = `${v.creator_name}|||${v.brand}`;
                if (!creatorVelocity.has(key)) {
                    creatorVelocity.set(key, { creator_name: v.creator_name, brand: v.brand, videos: 0, gmv: 0 });
                }
                const c = creatorVelocity.get(key);
                c.videos++;
                c.gmv += v.gmv;
            });
            
            const velocityList = [...creatorVelocity.values()]
                .map(c => ({ ...c, gmvPerVideo: c.videos > 0 ? c.gmv / c.videos : 0 }))
                .filter(c => c.videos >= 2) // At least 2 videos
                .sort((a, b) => b.gmvPerVideo - a.gmvPerVideo)
                .slice(0, 10);
            
            const maxVelocity = velocityList.length > 0 ? velocityList[0].gmvPerVideo : 1;
            
            document.getElementById('videoVelocityList').innerHTML = velocityList.length === 0
                ? '<tr><td colspan="7" style="text-align: center; padding: 40px; color: var(--text-muted);">Not enough data (need 2+ videos per creator)</td></tr>'
                : velocityList.map((c, i) => {
                    const efficiency = (c.gmvPerVideo / maxVelocity) * 100;
                    return `
                        <tr style="cursor: pointer;" onclick="openCreatorDetail('${c.creator_name}', '${c.brand}')">
                            <td style="text-align: center; color: ${i < 3 ? 'var(--warning)' : 'var(--text-muted)'}; font-weight: 600;">${i + 1}</td>
                            <td style="font-weight: 600;">@${c.creator_name}</td>
                            <td><span style="padding: 2px 6px; background: var(--accent-dim); border-radius: 4px; font-size: 0.75rem;">${BRAND_ICONS[c.brand] || ''}</span></td>
                            <td style="text-align: center;">${c.videos}</td>
                            <td style="text-align: right; color: var(--success);">${fmtMoney(c.gmv)}</td>
                            <td style="text-align: right; font-weight: 600; color: var(--blue);">${fmtMoney(c.gmvPerVideo)}</td>
                            <td style="text-align: center;">
                                <div style="width: 80px; height: 8px; background: var(--bg-secondary); border-radius: 4px; overflow: hidden;">
                                    <div style="width: ${efficiency}%; height: 100%; background: var(--success); border-radius: 4px;"></div>
                                </div>
                            </td>
                        </tr>
                    `;
                }).join('');
            
            // Duds (videos with 0 or very low GMV)
            const dudsList = [...videos]
                .filter(v => v.gmv < 10)
                .sort((a, b) => a.gmv - b.gmv)
                .slice(0, 10);
            
            document.getElementById('dudVideosList').innerHTML = dudsList.length === 0
                ? '<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--text-muted);">No underperforming videos — great job! 🎉</td></tr>'
                : dudsList.map(v => `
                    <tr>
                        <td>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="cursor: pointer; color: var(--accent);" onclick="openVideoEmbed('${v.video_id}', '${(v.video_title || '').replace(/'/g, "\\'")}', ${v.gmv}, ${v.orders}, '${v.creator_name}')">▶</span>
                                <span style="max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${v.video_title || 'Untitled'}">${v.video_title || 'Untitled'}</span>
                            </div>
                        </td>
                        <td>@${v.creator_name}</td>
                        <td><span style="padding: 2px 6px; background: var(--accent-dim); border-radius: 4px; font-size: 0.75rem;">${BRAND_ICONS[v.brand] || ''}</span></td>
                        <td style="text-align: right; color: var(--error);">${fmtMoney(v.gmv)}</td>
                        <td style="text-align: right;">${v.orders}</td>
                        <td style="text-align: center;">
                            <button class="btn btn-small" onclick="openCreatorDetail('${v.creator_name}', '${v.brand}')" title="View creator">👤</button>
                        </td>
                    </tr>
                `).join('');
        }
        
        function copyVideoUrl(videoId, creatorName) {
            const url = `https://www.tiktok.com/@${creatorName}/video/${videoId}`;
            navigator.clipboard.writeText(url).then(() => {
                showToast('Video URL copied!', 'success');
            }).catch(() => {
                showToast('Failed to copy', 'error');
            });
        }
        
        function openQuickAction(creatorName, brand) {
            // Quick action modal - for now just open creator detail
            openCreatorDetail(creatorName, brand);
        }
        
        function exportFilteredCreators() {
            let filtered = opsData.creators;
            if (opsData.currentQuadrant !== 'all') {
                filtered = opsData.creators.filter(c => c.quadrant === opsData.currentQuadrant);
            }
            
            if (filtered.length === 0) {
                showToast('No creators to export', 'error');
                return;
            }
            
            const headers = ['Creator', 'Brand', 'Videos', 'GMV', 'Prior GMV', 'WoW Change %', 'Last Contact', 'Status', 'Managed'];
            const rows = filtered.map(c => [
                c.creator_name,
                BRAND_DISPLAY[c.brand] || c.brand,
                c.videos,
                c.gmv.toFixed(2),
                (c.priorGmv || 0).toFixed(2),
                (c.gmvChange || 0).toFixed(1) + '%',
                c.lastContact || 'Never',
                c.quadrant,
                c.managed ? 'Yes' : 'No'
            ]);
            
            const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
            downloadCSV(csv, `ops-${opsData.currentQuadrant}-creators-${new Date().toISOString().split('T')[0]}.csv`);
            showToast(`Exported ${filtered.length} creators!`, 'success');
        }

        // ==================== WEEKLY REVIEW ====================
        let weeklyReviewData = {
            topPerformers: [],
            needsAttention: [],
            mostActive: [],
            belowTarget: [],
            totalGmv: 0,
            totalVideos: 0
        };
        
        async function loadWeeklyReview() {
            opsData.weeklyReviewLoaded = true;
            
            const brand = document.getElementById('opsBrandFilter')?.value || 'all';
            const managedOnly = document.getElementById('opsManagedOnly')?.checked ?? true;
            
            // Get date range from filters (or default to last 7 days)
            let startStr = document.getElementById('opsDateFilterStart')?.value;
            let endStr = document.getElementById('opsDateFilterEnd')?.value;
            
            // Fallback to last 7 days if not set
            if (!startStr || !endStr) {
                const endDate = new Date();
                const startDate = new Date();
                startDate.setDate(startDate.getDate() - 7);
                startStr = startDate.toISOString().split('T')[0];
                endStr = endDate.toISOString().split('T')[0];
            }
            
            // Calculate prior period (same length as current period)
            const startDate = new Date(startStr);
            const endDate = new Date(endStr);
            const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
            
            const priorEndDate = new Date(startDate);
            priorEndDate.setDate(priorEndDate.getDate() - 1);
            const priorStartDate = new Date(priorEndDate);
            priorStartDate.setDate(priorStartDate.getDate() - daysDiff);
            const priorStartStr = priorStartDate.toISOString().split('T')[0];
            const priorEndStr = priorEndDate.toISOString().split('T')[0];
            
            // Update header subtitle with date range
            const formatDate = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const subtitleEl = document.querySelector('#ops-tab-weeklyreview p');
            if (subtitleEl) {
                subtitleEl.textContent = `${formatDate(startStr)} - ${formatDate(endStr)} • ${managedOnly ? 'Managed only' : 'All creators'}`;
            }
            
            try {
                // Load managed creators
                await loadManagedCreators();
                
                // Get current period performance data (videos column = posts that day)
                let perfQuery = supabaseClient
                    .from('creator_performance')
                    .select('creator_name, brand, gmv, orders, videos, report_date')
                    .gte('report_date', startStr)
                    .lte('report_date', endStr);
                
                if (brand !== 'all') perfQuery = perfQuery.eq('brand', brand);
                
                const { data: perfData, error: perfError } = await perfQuery;
                if (perfError) throw perfError;
                
                // Get prior period for comparison
                let priorQuery = supabaseClient
                    .from('creator_performance')
                    .select('creator_name, brand, gmv')
                    .gte('report_date', priorStartStr)
                    .lte('report_date', priorEndStr);
                
                if (brand !== 'all') priorQuery = priorQuery.eq('brand', brand);
                
                const { data: priorData } = await priorQuery;
                
                // Aggregate by creator
                const creatorGmv = {};
                const creatorVideos = {};
                const priorGmv = {};
                
                // Current period GMV and videos (sum daily video counts)
                (perfData || []).forEach(row => {
                    const key = `${row.creator_name.toLowerCase()}|${row.brand}`;
                    if (!creatorGmv[key]) {
                        creatorGmv[key] = { name: row.creator_name, brand: row.brand, gmv: 0, orders: 0 };
                    }
                    creatorGmv[key].gmv += parseFloat(row.gmv) || 0;
                    creatorGmv[key].orders += parseInt(row.orders) || 0;
                    
                    // Sum up daily video counts
                    if (!creatorVideos[key]) {
                        creatorVideos[key] = { name: row.creator_name, brand: row.brand, count: 0 };
                    }
                    creatorVideos[key].count += parseInt(row.videos) || 0;
                });
                
                // Prior period GMV
                (priorData || []).forEach(row => {
                    const key = `${row.creator_name.toLowerCase()}|${row.brand}`;
                    if (!priorGmv[key]) priorGmv[key] = 0;
                    priorGmv[key] += parseFloat(row.gmv) || 0;
                });
                
                // Build managed set for filtering
                const managedSet = new Set();
                const managedRetainers = {};
                const managedInfo = {}; // To get real names
                managedCreators.forEach(mc => {
                    [mc.account_1, mc.account_2, mc.account_3, mc.account_4, mc.account_5].forEach(acc => {
                        if (acc) {
                            const key = `${normalizeTikTok(acc)}|${mc.brand}`;
                            managedSet.add(key);
                            // Store retainer value (including 0 for affiliates, null for not set)
                            const retainerVal = mc.retainer !== null && mc.retainer !== undefined && mc.retainer !== '' 
                                ? parseFloat(mc.retainer) 
                                : null;
                            managedRetainers[key] = retainerVal;
                            managedInfo[key] = {
                                realName: mc.real_name || mc.discord_name || mc.account_1,
                                handle: mc.account_1
                            };
                        }
                    });
                });
                
                // Build GMV list (filter by managedOnly setting)
                const gmvList = Object.entries(creatorGmv)
                    .filter(([key]) => {
                        if (!managedOnly) return true; // Include all if not filtering
                        const [name, b] = key.split('|');
                        const normKey = `${normalizeTikTok(name)}|${b}`;
                        return managedSet.has(normKey);
                    })
                    .map(([key, data]) => {
                        const [name, b] = key.split('|');
                        const normKey = `${normalizeTikTok(name)}|${b}`;
                        const prior = priorGmv[key] || 0;
                        const change = prior > 0 ? ((data.gmv - prior) / prior) * 100 : 0;
                        return {
                            ...data,
                            priorGmv: prior,
                            change,
                            retainer: managedRetainers[normKey], // Can be null, 0, or positive
                            isManaged: managedSet.has(normKey)
                        };
                    });
                
                // Build video list
                let videoList = [];
                if (managedOnly) {
                    // For managed only, use managed creators list
                    managedCreators.forEach(mc => {
                        if (brand !== 'all' && mc.brand !== brand) return;
                        
                        const accounts = [mc.account_1, mc.account_2, mc.account_3, mc.account_4, mc.account_5].filter(Boolean);
                        let totalVideos = 0;
                        accounts.forEach(acc => {
                            const vData = Object.entries(creatorVideos).find(([k]) => {
                                const [n, b] = k.split('|');
                                return normalizeTikTok(n) === normalizeTikTok(acc) && b === mc.brand;
                            });
                            if (vData) totalVideos += vData[1].count;
                        });
                        
                        // Handle retainer: null/undefined/'' = not set, 0 = affiliate, >0 = has retainer
                        const retainerVal = mc.retainer !== null && mc.retainer !== undefined && mc.retainer !== '' 
                            ? parseFloat(mc.retainer) 
                            : null;
                        
                        videoList.push({
                            name: mc.real_name || mc.discord_name || mc.account_1,
                            handle: mc.account_1,
                            brand: mc.brand,
                            count: totalVideos,
                            retainer: retainerVal
                        });
                    });
                } else {
                    // For all creators, use video data
                    Object.entries(creatorVideos).forEach(([key, data]) => {
                        const [name, b] = key.split('|');
                        const normKey = `${normalizeTikTok(name)}|${b}`;
                        const info = managedInfo[normKey] || {};
                        videoList.push({
                            name: info.realName || data.name,
                            handle: data.name,
                            brand: data.brand,
                            count: data.count,
                            retainer: managedRetainers[normKey] // Can be null, 0, or positive
                        });
                    });
                }
                
                // Sort and categorize
                const sortedByGmv = [...gmvList].sort((a, b) => b.gmv - a.gmv);
                const sortedByVideos = [...videoList].sort((a, b) => b.count - a.count);
                
                // Top Performers: Top 20 by GMV OR GMV > $500 (full list for detail view)
                weeklyReviewData.topPerformers = sortedByGmv
                    .filter((c, i) => i < 20 || c.gmv >= 500);
                
                // Needs Attention: Has retainer but GMV < $100 OR GMV dropped 50%+ (full list)
                weeklyReviewData.needsAttention = gmvList
                    .filter(c => (c.retainer > 0 && c.gmv < 100) || (c.priorGmv > 100 && c.change < -50))
                    .sort((a, b) => a.gmv - b.gmv);
                
                // Most Active: 5+ videos (full list for detail view)
                weeklyReviewData.mostActive = sortedByVideos
                    .filter(c => c.count >= 5);
                
                // Below Target: < 5 videos (full list)
                weeklyReviewData.belowTarget = videoList
                    .filter(c => c.count < 5)
                    .sort((a, b) => a.count - b.count);
                
                // Totals
                weeklyReviewData.totalGmv = gmvList.reduce((s, c) => s + c.gmv, 0);
                weeklyReviewData.totalVideos = videoList.reduce((s, c) => s + c.count, 0);
                
                // Update UI
                renderWeeklyReview();
                
            } catch (err) {
                console.error('Failed to load weekly review:', err);
                showToast('Failed to load weekly review', 'error');
            }
        }
        
        function renderWeeklyReview() {
            const d = weeklyReviewData;
            const PREVIEW_LIMIT = 10;
            
            // Update stats
            document.getElementById('weeklyTotalGmv').textContent = fmtMoney(d.totalGmv);
            document.getElementById('weeklyTotalVideos').textContent = d.totalVideos.toLocaleString();
            document.getElementById('weeklyLowPosters').textContent = d.belowTarget.length;
            document.getElementById('weeklyNeedsAttention').textContent = d.needsAttention.length;
            
            // Update badge counts
            document.getElementById('weeklyTopPerformerCount').textContent = d.topPerformers.length;
            document.getElementById('weeklyNeedsAttentionCount').textContent = d.needsAttention.length;
            document.getElementById('weeklyMostActiveCount').textContent = d.mostActive.length;
            document.getElementById('weeklyBelowTargetCount').textContent = d.belowTarget.length;
            
            // Top Performers table (preview)
            const topPreview = d.topPerformers.slice(0, PREVIEW_LIMIT);
            let topHtml = topPreview.length === 0 
                ? '<tr><td colspan="3" style="padding: 20px; text-align: center; color: var(--text-muted);">No data</td></tr>'
                : topPreview.map((c, i) => `
                    <tr style="border-bottom: 1px solid var(--border);">
                        <td style="padding: 10px 16px;">
                            <div style="font-weight: 600;">${i + 1}. @${c.name}</div>
                            <div style="font-size: 0.75rem; color: var(--text-muted);">${BRAND_DISPLAY[c.brand] || c.brand}</div>
                        </td>
                        <td style="padding: 10px 16px; text-align: right;">
                            <div style="font-weight: 700; color: var(--success);">${fmtMoney(c.gmv)}</div>
                            ${c.change !== 0 ? `<div style="font-size: 0.75rem; color: ${c.change > 0 ? 'var(--success)' : 'var(--error)'};">${c.change > 0 ? '↑' : '↓'}${Math.abs(c.change).toFixed(0)}%</div>` : ''}
                        </td>
                    </tr>
                `).join('');
            if (d.topPerformers.length > PREVIEW_LIMIT) {
                topHtml += `<tr><td colspan="2" style="padding: 12px 16px; text-align: center; color: var(--accent); font-size: 0.85rem;">+${d.topPerformers.length - PREVIEW_LIMIT} more • Click for full list</td></tr>`;
            }
            document.getElementById('weeklyTopPerformers').innerHTML = topHtml;
            
            // Needs Attention table (preview)
            const attentionPreview = d.needsAttention.slice(0, PREVIEW_LIMIT);
            let attentionHtml = attentionPreview.length === 0 
                ? '<tr><td colspan="3" style="padding: 20px; text-align: center; color: var(--success);">✅ No concerns!</td></tr>'
                : attentionPreview.map(c => `
                    <tr style="border-bottom: 1px solid var(--border);">
                        <td style="padding: 10px 16px;">
                            <div style="font-weight: 600;">@${c.name}</div>
                            <div style="font-size: 0.75rem; color: var(--text-muted);">${BRAND_DISPLAY[c.brand] || c.brand}</div>
                        </td>
                        <td style="padding: 10px 16px; text-align: right;">
                            <div style="font-weight: 700; color: var(--error);">${fmtMoney(c.gmv)}</div>
                            ${c.retainer > 0 ? `<div style="font-size: 0.7rem; color: var(--warning);">💵 ${fmtMoney(c.retainer)} retainer</div>` : (c.retainer === 0 ? '<div style="font-size: 0.7rem;"><span class="badge" style="background: var(--blue-dim); color: var(--blue); font-size: 0.65rem;">Affiliate</span></div>' : '')}
                            ${c.change < -50 ? `<div style="font-size: 0.7rem; color: var(--error);">↓${Math.abs(c.change).toFixed(0)}% from last week</div>` : ''}
                        </td>
                    </tr>
                `).join('');
            if (d.needsAttention.length > PREVIEW_LIMIT) {
                attentionHtml += `<tr><td colspan="2" style="padding: 12px 16px; text-align: center; color: var(--accent); font-size: 0.85rem;">+${d.needsAttention.length - PREVIEW_LIMIT} more • Click for full list</td></tr>`;
            }
            document.getElementById('weeklyNeedsAttentionList').innerHTML = attentionHtml;
            
            // Most Active table (preview)
            const activePreview = d.mostActive.slice(0, PREVIEW_LIMIT);
            let activeHtml = activePreview.length === 0 
                ? '<tr><td colspan="3" style="padding: 20px; text-align: center; color: var(--text-muted);">No data</td></tr>'
                : activePreview.map((c, i) => `
                    <tr style="border-bottom: 1px solid var(--border);">
                        <td style="padding: 10px 16px;">
                            <div style="font-weight: 600;">${i + 1}. ${c.name}</div>
                            <div style="font-size: 0.75rem; color: var(--text-muted);">${BRAND_DISPLAY[c.brand] || c.brand}</div>
                        </td>
                        <td style="padding: 10px 16px; text-align: right;">
                            <div style="font-weight: 700; color: var(--blue);">${c.count} videos</div>
                        </td>
                    </tr>
                `).join('');
            if (d.mostActive.length > PREVIEW_LIMIT) {
                activeHtml += `<tr><td colspan="2" style="padding: 12px 16px; text-align: center; color: var(--accent); font-size: 0.85rem;">+${d.mostActive.length - PREVIEW_LIMIT} more • Click for full list</td></tr>`;
            }
            document.getElementById('weeklyMostActive').innerHTML = activeHtml;
            
            // Below Target table (preview)
            const belowPreview = d.belowTarget.slice(0, PREVIEW_LIMIT);
            let belowHtml = belowPreview.length === 0 
                ? '<tr><td colspan="3" style="padding: 20px; text-align: center; color: var(--success);">✅ Everyone hitting target!</td></tr>'
                : belowPreview.map(c => `
                    <tr style="border-bottom: 1px solid var(--border);">
                        <td style="padding: 10px 16px;">
                            <div style="font-weight: 600;">${c.name}</div>
                            <div style="font-size: 0.75rem; color: var(--text-muted);">${BRAND_DISPLAY[c.brand] || c.brand}</div>
                        </td>
                        <td style="padding: 10px 16px; text-align: right;">
                            <div style="font-weight: 700; color: ${c.count === 0 ? 'var(--error)' : 'var(--warning)'};">${c.count} videos</div>
                            ${c.retainer > 0 ? `<div style="font-size: 0.7rem; color: var(--warning);">💵 ${fmtMoney(c.retainer)}/mo</div>` : (c.retainer === 0 ? '<div style="font-size: 0.7rem;"><span class="badge" style="background: var(--blue-dim); color: var(--blue); font-size: 0.65rem;">Affiliate</span></div>' : '')}
                        </td>
                    </tr>
                `).join('');
            if (d.belowTarget.length > PREVIEW_LIMIT) {
                belowHtml += `<tr><td colspan="2" style="padding: 12px 16px; text-align: center; color: var(--accent); font-size: 0.85rem;">+${d.belowTarget.length - PREVIEW_LIMIT} more • Click for full list</td></tr>`;
            }
            document.getElementById('weeklyBelowTarget').innerHTML = belowHtml;
        }
        
        function copyWeeklyReviewForDiscord() {
            const d = weeklyReviewData;
            const brand = document.getElementById('opsBrandFilter')?.value || 'all';
            const brandName = brand === 'all' ? 'All Brands' : (BRAND_DISPLAY[brand] || brand);
            
            let text = `📋 **Weekly Creator Review - ${brandName}**\n`;
            text += `Last 7 Days | Total GMV: ${fmtMoney(d.totalGmv)} | Videos: ${d.totalVideos}\n\n`;
            
            // Top Performers
            text += `🌟 **TOP PERFORMERS**\n`;
            if (d.topPerformers.length === 0) {
                text += `No standout performers this week\n`;
            } else {
                d.topPerformers.slice(0, 5).forEach((c, i) => {
                    text += `${i + 1}. @${c.name} - ${fmtMoney(c.gmv)}`;
                    if (c.change > 20) text += ` 📈`;
                    text += `\n`;
                });
                if (d.topPerformers.length > 5) text += `   +${d.topPerformers.length - 5} more\n`;
            }
            
            // Needs Attention
            text += `\n⚠️ **NEEDS ATTENTION** (${d.needsAttention.length})\n`;
            if (d.needsAttention.length === 0) {
                text += `All good! No concerns.\n`;
            } else {
                d.needsAttention.slice(0, 5).forEach(c => {
                    text += `• @${c.name} - ${fmtMoney(c.gmv)}`;
                    if (c.retainer > 0) text += ` (${fmtMoney(c.retainer)} retainer)`;
                    if (c.change < -50) text += ` ↓${Math.abs(c.change).toFixed(0)}%`;
                    text += `\n`;
                });
                if (d.needsAttention.length > 5) text += `   +${d.needsAttention.length - 5} more\n`;
            }
            
            // Below 5 Posts
            text += `\n😴 **BELOW 5 POSTS** (${d.belowTarget.length})\n`;
            if (d.belowTarget.length === 0) {
                text += `Everyone hitting posting target! 🎉\n`;
            } else {
                const zeroPosts = d.belowTarget.filter(c => c.count === 0);
                const lowPosts = d.belowTarget.filter(c => c.count > 0 && c.count < 5);
                
                if (zeroPosts.length > 0) {
                    text += `**0 posts:** ${zeroPosts.slice(0, 8).map(c => c.name).join(', ')}`;
                    if (zeroPosts.length > 8) text += ` +${zeroPosts.length - 8} more`;
                    text += `\n`;
                }
                if (lowPosts.length > 0) {
                    text += `**1-4 posts:** ${lowPosts.slice(0, 8).map(c => `${c.name} (${c.count})`).join(', ')}`;
                    if (lowPosts.length > 8) text += ` +${lowPosts.length - 8} more`;
                    text += `\n`;
                }
            }
            
            navigator.clipboard.writeText(text).then(() => {
                showToast('Copied to clipboard!', 'success');
            }).catch(() => {
                showToast('Failed to copy', 'error');
            });
        }
        
        // ==================== ROI REPORT ====================
        let roiReportData = [];
        let roiReportFiltered = [];
        
        async function loadRoiReport() {
            opsData.roiReportLoaded = true;
            const tbody = document.getElementById('roiReportBody');
            tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px; color: var(--text-muted);">Loading...</td></tr>';
            
            try {
                // Check for product and brand filters from Ops Center header
                const selectedProduct = document.getElementById('opsProductFilter')?.value || 'all';
                const selectedBrand = document.getElementById('opsBrandFilter')?.value || 'all';
                
                // Load managed creators with retainers
                await loadManagedCreators();
                
                // Filter creators based on retainer
                // If product selected, include creators with either base retainer OR product-specific retainer
                let retainerCreators;
                if (selectedProduct !== 'all') {
                    retainerCreators = managedCreators.filter(c => {
                        const baseRetainer = c.retainer || 0;
                        const productRetainer = (c.product_retainers || {})[selectedProduct] || 0;
                        return baseRetainer > 0 || productRetainer > 0;
                    });
                    retainerCreators = filterCreatorsByProduct(retainerCreators, selectedProduct);
                } else {
                    // Include creators with any retainer (overall OR product-specific)
                    retainerCreators = managedCreators.filter(c => hasAnyRetainer(c));
                }
                
                // Filter by brand if selected
                if (selectedBrand !== 'all') {
                    retainerCreators = retainerCreators.filter(c => c.brand === selectedBrand);
                }
                
                if (retainerCreators.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 60px; color: var(--text-muted);"><div style="font-size: 2rem; margin-bottom: 8px;">📊</div>No creators on retainer' + (selectedProduct !== 'all' ? ' for this product' : '') + '</td></tr>';
                    // Reset stats
                    document.getElementById('roiTotalRetainers').textContent = '0';
                    document.getElementById('roiTotalSpend').textContent = '$0';
                    document.getElementById('roiTotalGmv').textContent = '$0';
                    document.getElementById('roiAverageRoi').textContent = '0x';
                    document.getElementById('roiUnderperforming').textContent = '0';
                    return;
                }
                
                // Get performance data for last 30 days
                const endDate = new Date();
                const startDate = new Date();
                startDate.setDate(startDate.getDate() - 30);
                
                const priorEndDate = new Date(startDate);
                priorEndDate.setDate(priorEndDate.getDate() - 1);
                const priorStartDate = new Date(priorEndDate);
                priorStartDate.setDate(priorStartDate.getDate() - 30);
                
                const startStr = startDate.toISOString().split('T')[0];
                const endStr = endDate.toISOString().split('T')[0];
                const priorStartStr = priorStartDate.toISOString().split('T')[0];
                const priorEndStr = priorEndDate.toISOString().split('T')[0];
                
                // Fetch GMV data - either from video_performance (product) or creator_performance (brand)
                let gmvMap = {};
                let priorGmvMap = {};
                
                if (selectedProduct !== 'all') {
                    // Use product-level GMV from video_performance
                    gmvMap = await getProductGmv(selectedProduct, startStr, endStr, selectedBrand);
                    priorGmvMap = await getProductGmv(selectedProduct, priorStartStr, priorEndStr, selectedBrand);
                } else {
                    // Use brand-level GMV from creator_performance
                    const { data: perfData } = await supabaseClient
                        .from('creator_performance')
                        .select('creator_name, brand, gmv')
                        .gte('report_date', startStr)
                        .lte('report_date', endStr);
                    
                    const { data: priorPerfData } = await supabaseClient
                        .from('creator_performance')
                        .select('creator_name, brand, gmv')
                        .gte('report_date', priorStartStr)
                        .lte('report_date', priorEndStr);
                    
                    (perfData || []).forEach(row => {
                        const key = `${row.creator_name.toLowerCase()}|${row.brand}`;
                        gmvMap[key] = (gmvMap[key] || 0) + (parseFloat(row.gmv) || 0);
                    });
                    
                    (priorPerfData || []).forEach(row => {
                        const key = `${row.creator_name.toLowerCase()}|${row.brand}`;
                        priorGmvMap[key] = (priorGmvMap[key] || 0) + (parseFloat(row.gmv) || 0);
                    });
                }
                
                // Build ROI data
                roiReportData = retainerCreators.map(c => {
                    const accounts = [c.account_1, c.account_2, c.account_3].filter(Boolean);
                    let totalGmv = 0;
                    let priorGmv = 0;
                    
                    accounts.forEach(acc => {
                        const key = `${acc.toLowerCase()}|${c.brand}`;
                        totalGmv += gmvMap[key] || 0;
                        priorGmv += priorGmvMap[key] || 0;
                    });
                    
                    // Determine which retainer to use
                    // If product selected, use product-specific retainer; otherwise use base retainer
                    let effectiveRetainer = c.retainer;
                    if (selectedProduct !== 'all') {
                        const productRetainers = c.product_retainers || {};
                        effectiveRetainer = productRetainers[selectedProduct] || 0;
                    }
                    
                    const commission = totalGmv * 0.02;
                    const roi = effectiveRetainer > 0 ? (totalGmv / effectiveRetainer) : 0;
                    const priorRoi = effectiveRetainer > 0 ? (priorGmv / effectiveRetainer) : 0;
                    const roiChange = priorRoi > 0 ? ((roi - priorRoi) / priorRoi * 100) : 0;
                    
                    return {
                        name: c.real_name || c.discord_name || c.account_1,
                        handle: c.account_1,
                        brand: c.brand,
                        retainer: effectiveRetainer,
                        baseRetainer: c.retainer,
                        gmv: totalGmv,
                        commission: commission,
                        roi: roi,
                        roiChange: roiChange,
                        status: c.status
                    };
                });
                
                // Update summary stats
                const totalCreators = roiReportData.length;
                const totalSpend = roiReportData.reduce((s, c) => s + c.retainer, 0);
                const totalGmv = roiReportData.reduce((s, c) => s + c.gmv, 0);
                const avgRoi = totalCreators > 0 ? roiReportData.reduce((s, c) => s + c.roi, 0) / totalCreators : 0;
                const underperforming = roiReportData.filter(c => c.roi < 1).length;
                
                document.getElementById('roiTotalRetainers').textContent = totalCreators;
                document.getElementById('roiTotalSpend').textContent = fmtMoney(totalSpend);
                document.getElementById('roiTotalGmv').textContent = fmtMoney(totalGmv);
                document.getElementById('roiAverageRoi').textContent = avgRoi.toFixed(1) + 'x';
                document.getElementById('roiAverageRoi').style.color = avgRoi >= 1 ? 'var(--success)' : 'var(--error)';
                document.getElementById('roiUnderperforming').textContent = underperforming;
                
                // Render table
                filterRoiReport();
                
            } catch (err) {
                console.error('Error loading ROI report:', err);
                tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px; color: var(--error);">Error loading data</td></tr>';
            }
        }
        
        function filterRoiReport() {
            const brand = document.getElementById('roiBrandFilter')?.value || 'all';
            const status = document.getElementById('roiStatusFilter')?.value || 'all';
            const sort = document.getElementById('roiSortBy')?.value || 'roi-desc';
            const search = (document.getElementById('roiSearchFilter')?.value || '').toLowerCase();
            
            // Filter
            roiReportFiltered = roiReportData.filter(c => {
                if (brand !== 'all' && c.brand !== brand) return false;
                if (status === 'profitable' && c.roi < 1) return false;
                if (status === 'underperforming' && c.roi >= 1) return false;
                if (status === 'critical' && c.roi >= 0.5) return false;
                if (search && !c.name.toLowerCase().includes(search) && !c.handle.toLowerCase().includes(search)) return false;
                return true;
            });
            
            // Sort
            const [field, dir] = sort.split('-');
            const mult = dir === 'desc' ? -1 : 1;
            roiReportFiltered.sort((a, b) => {
                let aVal, bVal;
                switch (field) {
                    case 'roi': aVal = a.roi; bVal = b.roi; break;
                    case 'retainer': aVal = a.retainer; bVal = b.retainer; break;
                    case 'gmv': aVal = a.gmv; bVal = b.gmv; break;
                    case 'name': return mult * a.name.localeCompare(b.name);
                    default: return 0;
                }
                return mult * (bVal - aVal);
            });
            
            // Update summary cards based on filtered data
            const totalCreators = roiReportFiltered.length;
            const totalSpend = roiReportFiltered.reduce((s, c) => s + c.retainer, 0);
            const totalGmv = roiReportFiltered.reduce((s, c) => s + c.gmv, 0);
            const avgRoi = totalCreators > 0 ? roiReportFiltered.reduce((s, c) => s + c.roi, 0) / totalCreators : 0;
            const underperforming = roiReportFiltered.filter(c => c.roi < 1).length;
            
            document.getElementById('roiTotalRetainers').textContent = totalCreators;
            document.getElementById('roiTotalSpend').textContent = fmtMoney(totalSpend);
            document.getElementById('roiTotalGmv').textContent = fmtMoney(totalGmv);
            document.getElementById('roiAverageRoi').textContent = avgRoi.toFixed(1) + 'x';
            document.getElementById('roiAverageRoi').style.color = avgRoi >= 1 ? 'var(--success)' : 'var(--error)';
            document.getElementById('roiUnderperforming').textContent = underperforming;
            
            // Update count
            document.getElementById('roiTableCount').textContent = `Showing ${roiReportFiltered.length} of ${roiReportData.length}`;
            
            // Render
            renderRoiTable();
        }
        
        function renderRoiTable() {
            const tbody = document.getElementById('roiReportBody');
            
            if (roiReportFiltered.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px; color: var(--text-muted);">No matching creators</td></tr>';
                return;
            }
            
            tbody.innerHTML = roiReportFiltered.map(c => {
                const roiColor = c.roi >= 1 ? 'var(--success)' : (c.roi >= 0.5 ? 'var(--warning)' : 'var(--error)');
                const statusBadge = c.roi >= 1 
                    ? '<span class="badge" style="background: var(--success-dim); color: var(--success);">✅ Profitable</span>'
                    : (c.roi >= 0.5 
                        ? '<span class="badge" style="background: var(--warning-dim); color: var(--warning);">⚠️ Low</span>'
                        : '<span class="badge" style="background: var(--error-dim); color: var(--error);">🔴 Critical</span>');
                
                const trendIcon = c.roiChange >= 10 ? '📈' : (c.roiChange <= -10 ? '📉' : '➡️');
                const trendColor = c.roiChange >= 0 ? 'var(--success)' : 'var(--error)';
                
                return `
                    <tr>
                        <td>
                            <div style="font-weight: 600;">${c.name}</div>
                            <div style="font-size: 0.75rem; color: var(--text-muted);">@${c.handle}</div>
                        </td>
                        <td><span class="badge-brand">${BRAND_DISPLAY[c.brand] || c.brand}</span></td>
                        <td style="text-align: right; font-weight: 600;">${fmtMoney(c.retainer)}</td>
                        <td style="text-align: right; font-weight: 600; color: var(--success);">${fmtMoney(c.gmv)}</td>
                        <td style="text-align: right; color: var(--text-muted);">${fmtMoney(c.commission)}</td>
                        <td style="text-align: center;"><span style="font-weight: 700; font-size: 1.1rem; color: ${roiColor};">${c.roi.toFixed(1)}x</span></td>
                        <td style="text-align: center;">${statusBadge}</td>
                        <td style="text-align: center;">
                            <span style="color: ${trendColor};">${trendIcon}</span>
                            <span style="font-size: 0.75rem; color: ${trendColor};">${c.roiChange >= 0 ? '+' : ''}${c.roiChange.toFixed(0)}%</span>
                        </td>
                    </tr>
                `;
            }).join('');
        }
        
        function exportRoiReport() {
            if (roiReportFiltered.length === 0) {
                showToast('No data to export', 'warning');
                return;
            }
            
            const headers = ['Creator', 'Handle', 'Brand', 'Retainer', 'GMV (30d)', 'Commission', 'ROI', 'Status'];
            const rows = roiReportFiltered.map(c => [
                c.name,
                `@${c.handle}`,
                c.brand,
                c.retainer.toFixed(2),
                c.gmv.toFixed(2),
                c.commission.toFixed(2),
                c.roi.toFixed(2) + 'x',
                c.roi >= 1 ? 'Profitable' : (c.roi >= 0.5 ? 'Low' : 'Critical')
            ]);
            
            const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
            downloadCSV(csv, `roi-report-${new Date().toISOString().split('T')[0]}.csv`);
            showToast(`Exported ${roiReportFiltered.length} rows!`, 'success');
        }
        
        // ==================== END ROI REPORT ====================
        
        // ==================== DECISIONS DASHBOARD ====================
        let decisionsData = [];
        let decisionsCategories = { cut: [], watch: [], keep: [] };
        
        // Toggle decision section visibility
        function toggleDecisionSection(section) {
            const content = document.getElementById(`decisions${section.charAt(0).toUpperCase() + section.slice(1)}Content`);
            const toggle = document.getElementById(`decisions${section.charAt(0).toUpperCase() + section.slice(1)}Toggle`);
            if (!content || !toggle) return;
            
            const isHidden = content.style.display === 'none';
            content.style.display = isHidden ? 'grid' : 'none';
            toggle.textContent = isHidden ? '▼' : '▶';
            
            // Update border radius
            const header = content.previousElementSibling;
            if (header) {
                header.style.borderRadius = isHidden ? '12px 12px 0 0' : '12px';
            }
        }
        
        // Copy decision section to Discord
        function copyDecisionDiscord(section) {
            const brand = document.getElementById('decisionsBrandFilter')?.value || 'all';
            const brandName = brand === 'all' ? 'All Brands' : BRAND_DISPLAY[brand];
            const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            
            let creators = decisionsCategories[section] || [];
            if (creators.length === 0) {
                showToast(`No ${section} creators to copy`, 'warning');
                return;
            }
            
            creators = creators.slice(0, 20);
            let text = '';
            
            switch(section) {
                case 'cut':
                    text = `✂️ **RECOMMEND CUT - ${brandName}** ✂️\n`;
                    text += `_Below 1x ROI - losing money (${today})_\n\n`;
                    creators.forEach((c, i) => {
                        text += `**${i + 1}. @${c.handle}** - ${c.roi.toFixed(1)}x ROI - ${fmtMoney(c.retainer)}/mo\n`;
                        text += `   📊 GMV: ${fmtMoney(c.gmv)} | Posts: ${c.postsPeriod}/${c.postReq}\n`;
                    });
                    const totalAtRisk = creators.reduce((sum, c) => sum + c.retainer, 0);
                    text += `\n**💰 Total at risk: ${fmtMoney(totalAtRisk)}/mo**`;
                    break;
                    
                case 'watch':
                    text = `👀 **WATCH LIST - ${brandName}** 👀\n`;
                    text += `_1-3x ROI - monitor closely (${today})_\n\n`;
                    creators.forEach((c, i) => {
                        text += `**${i + 1}. @${c.handle}** - ${c.roi.toFixed(1)}x ROI - ${fmtMoney(c.retainer)}/mo\n`;
                    });
                    break;
                    
                case 'keep':
                    text = `✅ **KEEP - ${brandName}** ✅\n`;
                    text += `_3x+ ROI - solid performers (${today})_\n\n`;
                    creators.forEach((c, i) => {
                        const starBadge = c.roi >= 10 ? '⭐ ' : '';
                        text += `${starBadge}**@${c.handle}** - ${c.roi.toFixed(1)}x ROI\n`;
                    });
                    break;
            }
            
            navigator.clipboard.writeText(text);
            showToast(`${section.charAt(0).toUpperCase() + section.slice(1)} list copied!`, 'success');
        }
        
        async function loadDecisions() {
            // Show loading state
            const sections = ['Cut', 'Watch', 'Keep'];
            sections.forEach(section => {
                const el = document.getElementById(`decisions${section}Grid`);
                if (el) el.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 30px; color: var(--text-muted);"><div class="spinner" style="margin: 0 auto 12px;"></div>Loading...</div>';
            });
            
            try {
                const selectedBrand = document.getElementById('decisionsBrandFilter')?.value || 'all';
                const selectedProduct = document.getElementById('decisionsProductFilter')?.value || 'all';
                
                // Load managed creators
                await loadManagedCreators();
                
                // Filter to retainer creators only (default view)
                let retainerCreators = managedCreators.filter(c => hasAnyRetainer(c) && c.status === 'Active');
                
                if (selectedBrand !== 'all') {
                    retainerCreators = retainerCreators.filter(c => c.brand === selectedBrand);
                }
                
                // Filter by product assignment if selected
                if (selectedProduct !== 'all') {
                    retainerCreators = retainerCreators.filter(c => {
                        const productRetainers = c.product_retainers || {};
                        // Creator is assigned if they have ANY entry for this product (including 0 or null)
                        return selectedProduct in productRetainers;
                    });
                }
                
                if (retainerCreators.length === 0) {
                    sections.forEach(section => {
                        const el = document.getElementById(`decisions${section}Grid`);
                        if (el) el.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 30px; color: var(--text-muted);">No retainer creators found' + (selectedProduct !== 'all' ? ' for this product' : '') + '</div>';
                    });
                    updateDecisionStats();
                    return;
                }
                
                // Helper to calculate contract period for a creator
                // Contract stays open from start date until manually reset
                // Returns { start: Date, end: Date, dayNumber: number, totalDays: number, isOverdue: boolean }
                function getContractPeriod(retainerStartDate, contractLengthDays = 30) {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const lengthDays = contractLengthDays || 30;
                    
                    if (!retainerStartDate) {
                        // No start date set - use rolling period as fallback
                        const start = new Date(today);
                        start.setDate(today.getDate() - (lengthDays - 1));
                        return {
                            start: start,
                            end: today,
                            dayNumber: lengthDays,
                            totalDays: lengthDays,
                            isDefault: true,
                            isOverdue: false
                        };
                    }
                    
                    const startDate = new Date(retainerStartDate);
                    startDate.setHours(0, 0, 0, 0);
                    
                    // Days since contract started (1-indexed)
                    const dayNumber = Math.floor((today - startDate) / (1000 * 60 * 60 * 24)) + 1;
                    
                    // Expected end date
                    const expectedEnd = new Date(startDate);
                    expectedEnd.setDate(expectedEnd.getDate() + lengthDays - 1);
                    
                    // Is the contract overdue?
                    const isOverdue = dayNumber > lengthDays;
                    
                    return {
                        start: startDate,
                        end: expectedEnd,
                        dayNumber: dayNumber,
                        totalDays: lengthDays,
                        isDefault: false,
                        isOverdue: isOverdue,
                        daysOverdue: isOverdue ? dayNumber - lengthDays : 0
                    };
                }
                
                // Get date range for ALL creators (need 60 days back for trends)
                const today = new Date();
                const localDateStrFn = (d) => d.toISOString().split('T')[0];
                const todayStr = localDateStrFn(today);
                
                const sixtyDaysAgo = new Date(today);
                sixtyDaysAgo.setDate(today.getDate() - 60);
                const sixtyDaysAgoStr = localDateStrFn(sixtyDaysAgo);
                
                // Update date range display
                document.getElementById('decisionsDateRange').innerHTML = `Contract period ROI • Based on each creator's start date`;
                
                // Fetch creator_performance data for last 60 days
                let perfQuery = supabaseClient
                    .from('creator_performance')
                    .select('creator_name, brand, gmv, videos, report_date')
                    .gte('report_date', sixtyDaysAgoStr)
                    .lte('report_date', todayStr)
                    .order('creator_name', { ascending: true })
                    .limit(30000);
                
                if (selectedBrand !== 'all') {
                    perfQuery = perfQuery.eq('brand', selectedBrand);
                }
                
                const { data: perfData, error: perfError } = await perfQuery;
                if (perfError) throw perfError;
                
                // Build a map of all performance data by creator|brand|date
                const perfByCreatorDate = {};
                (perfData || []).forEach(row => {
                    const key = `${row.creator_name.toLowerCase()}|${row.brand}|${row.report_date}`;
                    if (!perfByCreatorDate[key]) {
                        perfByCreatorDate[key] = { gmv: 0, videos: 0 };
                    }
                    perfByCreatorDate[key].gmv += pFloat(row.gmv);
                    perfByCreatorDate[key].videos += pInt(row.videos);
                });
                
                // Build decisions data with contract-specific periods
                decisionsData = retainerCreators.map(c => {
                    const accounts = [c.account_1, c.account_2, c.account_3, c.account_4, c.account_5].filter(a => a && a.trim());
                    const contractLength = c.contract_length_days || 30;
                    
                    // Get this creator's contract period
                    const period = getContractPeriod(c.retainer_start_date, contractLength);
                    const periodStartStr = localDateStrFn(period.start);
                    const periodEndStr = localDateStrFn(period.end);
                    
                    // Previous period for trend (same length as current period)
                    const prevPeriodEnd = new Date(period.start);
                    prevPeriodEnd.setDate(prevPeriodEnd.getDate() - 1);
                    const prevPeriodStart = new Date(prevPeriodEnd);
                    prevPeriodStart.setDate(prevPeriodStart.getDate() - (contractLength - 1));
                    const prevPeriodStartStr = localDateStrFn(prevPeriodStart);
                    const prevPeriodEndStr = localDateStrFn(prevPeriodEnd);
                    
                    // Sum GMV and posts for current and previous periods
                    let gmvPeriod = 0;
                    let gmvPrevPeriod = 0;
                    let postsPeriod = 0;
                    
                    accounts.forEach(acc => {
                        // Iterate through dates in current period
                        let d = new Date(period.start);
                        const endD = new Date(today); // Only count up to today
                        while (d <= endD) {
                            const dateStr = localDateStrFn(d);
                            const key = `${acc.toLowerCase()}|${c.brand}|${dateStr}`;
                            if (perfByCreatorDate[key]) {
                                gmvPeriod += perfByCreatorDate[key].gmv;
                                postsPeriod += perfByCreatorDate[key].videos;
                            }
                            d.setDate(d.getDate() + 1);
                        }
                        
                        // Iterate through dates in previous period
                        d = new Date(prevPeriodStart);
                        while (d <= prevPeriodEnd) {
                            const dateStr = localDateStrFn(d);
                            const key = `${acc.toLowerCase()}|${c.brand}|${dateStr}`;
                            if (perfByCreatorDate[key]) {
                                gmvPrevPeriod += perfByCreatorDate[key].gmv;
                            }
                            d.setDate(d.getDate() + 1);
                        }
                    });
                    
                    // Calculate retainer - use product-specific if product selected
                    let effectiveRetainer = getTotalRetainer(c);
                    if (selectedProduct !== 'all') {
                        const productRetainer = (c.product_retainers || {})[selectedProduct] || 0;
                        if (productRetainer > 0) {
                            effectiveRetainer = productRetainer;
                        }
                    }
                    
                    const roi = effectiveRetainer > 0 ? (gmvPeriod / effectiveRetainer) : 0;
                    const roiPrev = effectiveRetainer > 0 ? (gmvPrevPeriod / effectiveRetainer) : 0;
                    
                    // ROI trend
                    let roiTrend = 'stable';
                    if (roiPrev > 0) {
                        const roiChange = ((roi - roiPrev) / roiPrev) * 100;
                        if (roiChange > 10) roiTrend = 'up';
                        else if (roiChange < -10) roiTrend = 'down';
                    }
                    
                    // Determine category: Cut (<1x), Watch (1-3x), Keep (3x+), Stars (10x+)
                    let category = 'keep';
                    let isStar = false;
                    if (roi < 1) {
                        category = 'cut';
                    } else if (roi < 3) {
                        category = 'watch';
                    } else {
                        category = 'keep';
                        if (roi >= 10) isStar = true;
                    }
                    
                    // Posting compliance - based on contract period
                    const postReq = c.monthly_post_requirement || 30;
                    const postCompliance = postReq > 0 ? Math.round((postsPeriod / postReq) * 100) : 100;
                    const isBelowPostReq = postsPeriod < postReq;
                    
                    // Check if PC Fiber
                    const isPCFiber = c.brand === 'physicians_choice' && c.product_retainers && c.product_retainers['pc_fiber'] > 0;
                    
                    return {
                        id: c.id,
                        name: c.real_name || c.discord_name || c.account_1,
                        handle: c.account_1,
                        brand: c.brand,
                        retainer: effectiveRetainer,
                        gmv: gmvPeriod,
                        gmvPrev: gmvPrevPeriod,
                        roi: roi,
                        roiPrev: roiPrev,
                        roiTrend: roiTrend,
                        postsPeriod: postsPeriod,
                        postReq: postReq,
                        postCompliance: postCompliance,
                        isBelowPostReq: isBelowPostReq,
                        category: category,
                        isStar: isStar,
                        isPCFiber: isPCFiber,
                        productRetainers: c.product_retainers || {},
                        discordChannelId: c.discord_channel_id,
                        // Contract period info
                        periodStart: period.start,
                        periodEnd: period.end,
                        dayNumber: period.dayNumber,
                        totalDays: period.totalDays,
                        hasStartDate: !period.isDefault,
                        isOverdue: period.isOverdue,
                        daysOverdue: period.daysOverdue || 0
                    };
                });
                
                // Sort by ROI (worst first for cut, best first for keep)
                decisionsData.sort((a, b) => a.roi - b.roi);
                
                filterDecisions();
                
            } catch (err) {
                console.error('Error loading decisions:', err);
                const sections = ['Cut', 'Watch', 'Keep'];
                sections.forEach(section => {
                    const el = document.getElementById(`decisions${section}Grid`);
                    if (el) el.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 30px; color: var(--danger);">Error: ${err.message}</div>`;
                });
            }
        }
        
        function filterDecisions() {
            const creatorType = document.getElementById('decisionsTypeFilter')?.value || 'retainer';
            const search = document.getElementById('decisionsSearchFilter')?.value?.toLowerCase() || '';
            
            let filtered = decisionsData.filter(c => {
                if (creatorType === 'retainer' && c.retainer <= 0) return false;
                if (creatorType === 'pcfiber' && !c.isPCFiber) return false;
                if (search && !c.name.toLowerCase().includes(search) && !c.handle?.toLowerCase().includes(search)) return false;
                return true;
            });
            
            // Categorize
            decisionsCategories = {
                cut: filtered.filter(c => c.category === 'cut').sort((a, b) => a.roi - b.roi),
                watch: filtered.filter(c => c.category === 'watch').sort((a, b) => a.roi - b.roi),
                keep: filtered.filter(c => c.category === 'keep').sort((a, b) => b.roi - a.roi)
            };
            
            updateDecisionStats();
            renderDecisionSections();
        }
        
        function updateDecisionStats() {
            const cut = decisionsCategories.cut.length;
            const watch = decisionsCategories.watch.length;
            const keep = decisionsCategories.keep.length;
            const stars = decisionsCategories.keep.filter(c => c.isStar).length;
            
            // $ at risk = retainer for Cut + Watch
            const atRiskCreators = [...decisionsCategories.cut, ...decisionsCategories.watch];
            const atRisk = atRiskCreators.reduce((sum, c) => sum + c.retainer, 0);
            
            document.getElementById('decisionsCutCount').textContent = cut;
            document.getElementById('decisionsWatchCount').textContent = watch;
            document.getElementById('decisionsKeepCount').textContent = keep;
            document.getElementById('decisionsStarsCount').textContent = stars;
            document.getElementById('decisionsAtRisk').textContent = fmtMoney(atRisk);
            document.getElementById('decisionsAtRiskCreators').textContent = `${atRiskCreators.length} creator${atRiskCreators.length !== 1 ? 's' : ''}`;
            
            // Update badges
            document.getElementById('decisionsCutBadge').textContent = cut;
            document.getElementById('decisionsWatchBadge').textContent = watch;
            document.getElementById('decisionsKeepBadge').textContent = keep;
        }
        
        function renderDecisionSections() {
            renderDecisionSection('Cut', decisionsCategories.cut, '#ef4444');
            renderDecisionSection('Watch', decisionsCategories.watch, '#f59e0b');
            renderDecisionSection('Keep', decisionsCategories.keep, '#22c55e');
        }
        
        function renderDecisionSection(sectionName, creators, accentColor) {
            const container = document.getElementById(`decisions${sectionName}Grid`);
            if (!container) return;
            
            if (creators.length === 0) {
                const emptyMessages = {
                    'Cut': '✅ No creators to cut - everyone is performing!',
                    'Watch': '✅ No one on watch list!',
                    'Keep': 'No keepers found'
                };
                container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 30px; color: var(--text-muted);">${emptyMessages[sectionName] || 'No creators'}</div>`;
                return;
            }
            
            container.innerHTML = creators.map(c => renderDecisionCard(c, accentColor)).join('');
        }
        
        function renderDecisionCard(c, accentColor) {
            // ROI color
            const roiColor = c.roi >= 10 ? '#8b5cf6' : c.roi >= 3 ? '#22c55e' : c.roi >= 1 ? '#f59e0b' : '#ef4444';
            
            // ROI trend indicator
            const trendIcon = c.roiTrend === 'up' ? '↑' : c.roiTrend === 'down' ? '↓' : '→';
            const trendColor = c.roiTrend === 'up' ? '#22c55e' : c.roiTrend === 'down' ? '#ef4444' : 'var(--text-muted)';
            
            // Star badge
            const starBadge = c.isStar ? '<span style="background: #8b5cf6; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.6rem; font-weight: 600;">⭐ STAR</span>' : '';
            
            // PC Fiber badge
            const fiberBadge = c.isPCFiber ? '<span style="background: #10b981; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.6rem; font-weight: 600;">FIBER</span>' : '';
            
            // Posting compliance
            const postColor = c.postCompliance >= 100 ? '#22c55e' : c.postCompliance >= 80 ? '#f59e0b' : '#ef4444';
            const postFlag = c.isBelowPostReq ? `<span style="color: ${postColor}; font-size: 0.7rem;" title="Below ${c.postReq} post requirement">⚠️</span>` : '';
            
            // Discord button
            const discordBtn = c.discordChannelId 
                ? `<button onclick="openDiscordChannel('${c.brand}', '${c.discordChannelId}')" class="btn btn-sm" style="background: #5865F2; color: white; padding: 5px 10px; font-size: 0.7rem;">💬</button>`
                : '';
            
            // Contract period display
            const periodStart = c.periodStart ? c.periodStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
            const periodEnd = c.periodEnd ? c.periodEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
            
            // Build period label with overdue warning
            let periodLabel, periodColor;
            if (!c.hasStartDate) {
                periodLabel = `Rolling ${c.totalDays}d (no start date set)`;
                periodColor = '#f59e0b';
            } else if (c.isOverdue) {
                periodLabel = `⚠️ Day ${c.dayNumber}/${c.totalDays} (+${c.daysOverdue} overdue)`;
                periodColor = '#ef4444';
            } else {
                periodLabel = `${periodStart} - ${periodEnd} (Day ${c.dayNumber}/${c.totalDays})`;
                periodColor = 'var(--text-muted)';
            }
            
            return `
            <div style="background: var(--bg-secondary); border-radius: 10px; padding: 14px; border: 1px solid var(--border); border-left: 4px solid ${accentColor}; transition: transform 0.15s, box-shadow 0.15s;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.15)';" onmouseout="this.style.transform=''; this.style.boxShadow='';">
                <div style="display: flex; justify-content: space-between; align-items: start; gap: 12px;">
                    <!-- Left: Creator Info -->
                    <div style="flex: 1; min-width: 0;">
                        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px; flex-wrap: wrap;">
                            <span style="font-weight: 700; font-size: 0.95rem;">${sanitize(c.name)}</span>
                            ${starBadge}
                            ${fiberBadge}
                        </div>
                        <div style="display: flex; flex-wrap: wrap; gap: 6px; font-size: 0.75rem; color: var(--text-muted); margin-bottom: 6px;">
                            <a href="https://www.tiktok.com/@${c.handle}" target="_blank" style="color: var(--blue); text-decoration: none;">@${c.handle}</a>
                            <span>•</span>
                            <span class="badge-brand" style="font-size: 0.65rem;">${BRAND_DISPLAY[c.brand] || c.brand}</span>
                            <span>•</span>
                            <span style="color: var(--accent);">${fmtMoney(c.retainer)}/mo</span>
                        </div>
                        
                        <!-- Contract Period -->
                        <div style="font-size: 0.65rem; color: ${periodColor}; margin-bottom: 10px; font-weight: ${c.isOverdue ? '600' : 'normal'};">
                            📅 ${periodLabel}
                        </div>
                        
                        <!-- Metrics Grid -->
                        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; font-size: 0.75rem;">
                            <div>
                                <div style="color: var(--text-muted); font-size: 0.65rem;">Period GMV</div>
                                <div style="font-weight: 600; color: var(--success);">${fmtMoney(c.gmv)}</div>
                            </div>
                            <div>
                                <div style="color: var(--text-muted); font-size: 0.65rem;">Posts ${postFlag}</div>
                                <div style="font-weight: 600; color: ${postColor};">${c.postsPeriod}/${c.postReq}</div>
                            </div>
                            <div>
                                <div style="color: var(--text-muted); font-size: 0.65rem;">Prev Period</div>
                                <div style="font-weight: 600; color: ${trendColor};">${trendIcon} ${c.roiPrev > 0 ? c.roiPrev.toFixed(1) + 'x' : '--'}</div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Right: ROI + Actions -->
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
                        <div style="text-align: center;">
                            <div style="font-size: 2rem; font-weight: 800; color: ${roiColor}; line-height: 1;">${c.roi.toFixed(1)}x</div>
                            <div style="font-size: 0.6rem; color: var(--text-muted);">ROI</div>
                        </div>
                        <div style="display: flex; gap: 4px;">
                            ${discordBtn}
                            <button onclick="editCreator(${c.id})" class="btn btn-sm" style="padding: 5px 10px; font-size: 0.7rem;">✏️</button>
                        </div>
                    </div>
                </div>
            </div>`;
        }
        
        // ==================== END DECISIONS DASHBOARD ====================
        
        // ==================== POSTING ACCOUNTABILITY ====================
        let postingData = [];
        let postingFiltered = [];
        let postingCategories = { ghosts: [], behind: [], atrisk: [], ontrack: [], stars: [], trending: [] };
        let postingContactLog = {};
        
        // Load contact log from localStorage on init
        try {
            const saved = localStorage.getItem('creatorContactLog');
            if (saved) postingContactLog = JSON.parse(saved);
        } catch (e) {
            console.warn('Could not load contact log from localStorage');
        }
        
        // Toggle section visibility
        function togglePostingSection(section) {
            const content = document.getElementById(`posting${section.charAt(0).toUpperCase() + section.slice(1)}Content`);
            const toggle = document.getElementById(`posting${section.charAt(0).toUpperCase() + section.slice(1)}Toggle`);
            if (!content || !toggle) return;
            
            const isHidden = content.style.display === 'none';
            content.style.display = isHidden ? 'grid' : 'none';
            toggle.textContent = isHidden ? '▼' : '▶';
            
            // Update border radius
            const header = content.previousElementSibling;
            if (header) {
                header.style.borderRadius = isHidden ? '12px 12px 0 0' : '12px';
            }
        }
        
        // Handle brand change in Posting tab - load products for that brand
        async function onPostingBrandChange() {
            const brand = document.getElementById('postingBrandFilter')?.value || 'all';
            const productSelect = document.getElementById('postingProductFilter');
            
            // Reset product filter
            productSelect.innerHTML = '<option value="all">All Products</option>';
            
            try {
                // Load products from products table (for creator assignments)
                let productsQuery = supabaseClient.from('products')
                    .select('product_key, display_name, brand')
                    .eq('status', 'active')
                    .order('display_name');
                
                if (brand !== 'all') {
                    productsQuery = productsQuery.eq('brand', brand);
                }
                
                const { data: products, error: productsError } = await productsQuery;
                
                if (!productsError && products && products.length > 0) {
                    // Group by brand if showing all brands
                    if (brand === 'all') {
                        const byBrand = {};
                        products.forEach(p => {
                            if (!byBrand[p.brand]) byBrand[p.brand] = [];
                            byBrand[p.brand].push(p);
                        });
                        
                        Object.entries(byBrand).forEach(([b, prods]) => {
                            const optgroup = document.createElement('optgroup');
                            optgroup.label = BRAND_DISPLAY[b] || b;
                            prods.forEach(p => {
                                const option = document.createElement('option');
                                option.value = p.product_key;
                                option.textContent = p.display_name;
                                optgroup.appendChild(option);
                            });
                            productSelect.appendChild(optgroup);
                        });
                    } else {
                        products.forEach(p => {
                            const option = document.createElement('option');
                            option.value = p.product_key;
                            option.textContent = p.display_name;
                            productSelect.appendChild(option);
                        });
                    }
                }
                
                // Store products for filter reference
                window.postingProducts = products || [];
                
            } catch (err) {
                console.error('Error loading products for filter:', err);
            }
            
            // Load posting data with new filters
            loadPostingData();
        }
        
        // Helper to get product names for Posting GMV filter (from video_performance)
        function getPostingProductNamesForFilter(filterValue) {
            if (!filterValue || filterValue === 'all') {
                return null;
            }
            
            // Look up the product in our cached products to get its associated product_names
            const product = (window.postingProducts || []).find(p => p.product_key === filterValue);
            if (product && product.product_names && product.product_names.length > 0) {
                return product.product_names;
            }
            
            // Fallback: try to find by display_name match
            return [filterValue];
        }
        
        // Copy posting section to Discord
        function copyPostingDiscord(section) {
            if (!postingFiltered || postingFiltered.length === 0) {
                showToast('No posting data loaded', 'warning');
                return;
            }
            
            const brand = document.getElementById('postingBrandFilter')?.value || 'all';
            const brandName = brand === 'all' ? 'All Brands' : BRAND_DISPLAY[brand];
            const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            
            let creators = [];
            let text = '';
            
            switch(section) {
                case 'ghosts':
                    creators = postingCategories.ghosts.slice(0, 15);
                    if (creators.length === 0) { showToast('No ghost creators', 'warning'); return; }
                    text = `👻 **GHOST CREATORS - ${brandName}** 👻\n`;
                    text += `_Zero posts in last 7 days (${today})_\n\n`;
                    creators.forEach((c, i) => {
                        text += `**${i + 1}. @${c.handle}** - Last post: ${c.daysSincePost !== null ? c.daysSincePost + 'd ago' : 'Never'}\n`;
                        if (c.retainer > 0) text += `   💰 $${c.retainer} retainer\n`;
                    });
                    break;
                    
                case 'behind':
                    creators = postingCategories.behind.slice(0, 15);
                    if (creators.length === 0) { showToast('No behind creators', 'warning'); return; }
                    text = `🚨 **BEHIND ON POSTING - ${brandName}** 🚨\n`;
                    text += `_1-3 posts in last 7 days (${today})_\n\n`;
                    creators.forEach((c, i) => {
                        text += `**${i + 1}. @${c.handle}** - ${c.posts7d} posts (need 7+)\n`;
                        if (c.retainer > 0) text += `   💰 $${c.retainer} retainer at risk\n`;
                    });
                    break;
                    
                case 'atrisk':
                    creators = postingCategories.atrisk.slice(0, 15);
                    if (creators.length === 0) { showToast('No at-risk creators', 'warning'); return; }
                    text = `⚠️ **AT RISK - ${brandName}** ⚠️\n`;
                    text += `_4-5 posts in last 7 days (${today})_\n\n`;
                    creators.forEach((c, i) => {
                        text += `**${i + 1}. @${c.handle}** - ${c.posts7d} posts (need 7+)\n`;
                    });
                    break;
                    
                case 'ontrack':
                    creators = postingCategories.ontrack.slice(0, 15);
                    if (creators.length === 0) { showToast('No on-track creators', 'warning'); return; }
                    text = `✅ **ON TRACK - ${brandName}** ✅\n`;
                    text += `_6-9 posts in last 7 days (${today})_\n\n`;
                    creators.forEach((c, i) => {
                        text += `✅ **@${c.handle}** - ${c.posts7d} posts\n`;
                    });
                    break;
                    
                case 'stars':
                    creators = postingCategories.stars.slice(0, 15);
                    if (creators.length === 0) { showToast('No star creators', 'warning'); return; }
                    text = `⭐ **POSTING STARS - ${brandName}** ⭐\n`;
                    text += `_10+ posts in last 7 days - crushing it! (${today})_\n\n`;
                    creators.forEach((c, i) => {
                        text += `🏆 **@${c.handle}** - ${c.posts7d} posts!\n`;
                    });
                    break;
            }
            
            navigator.clipboard.writeText(text);
            showToast(`${section.charAt(0).toUpperCase() + section.slice(1)} list copied!`, 'success');
        }
        
        async function loadPostingData() {
            // Show loading state
            const sections = ['Ghosts', 'Behind', 'Atrisk', 'Ontrack', 'Stars'];
            sections.forEach(section => {
                const el = document.getElementById(`posting${section}Grid`);
                if (el) el.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 30px; color: var(--text-muted);"><div class="spinner" style="margin: 0 auto 12px;"></div>Loading...</div>';
            });
            
            try {
                const selectedBrand = document.getElementById('postingBrandFilter')?.value || 'all';
                const selectedProduct = document.getElementById('postingProductFilter')?.value || 'all';
                
                // Get ALL managed creators (Active only) - ordered for consistent results
                let query = supabaseClient.from('managed_creators').select('*')
                    .eq('status', 'Active')
                    .order('id', { ascending: true });
                if (selectedBrand !== 'all') {
                    query = query.eq('brand', selectedBrand);
                }
                
                const { data: managedCreatorsData, error: mcError } = await query;
                if (mcError) throw mcError;
                
                let allCreators = managedCreatorsData || [];
                
                // Only update global managedCreators when showing all brands
                // This prevents brand-filtered views from breaking other tabs
                if (selectedBrand === 'all') {
                    managedCreators = allCreators;
                }
                
                // Filter by product assignment if selected
                if (selectedProduct !== 'all') {
                    allCreators = allCreators.filter(c => {
                        const productRetainers = c.product_retainers || {};
                        // Creator is assigned if they have ANY entry for this product (including 0 or null)
                        return selectedProduct in productRetainers;
                    });
                }
                
                if (allCreators.length === 0) {
                    if (selectedProduct !== 'all') {
                        const productSelect = document.getElementById('postingProductFilter');
                        const productName = productSelect.options[productSelect.selectedIndex]?.textContent || selectedProduct;
                        const sections = ['Ghosts', 'Behind', 'Atrisk', 'Ontrack', 'Stars'];
                        sections.forEach(section => {
                            const el = document.getElementById(`posting${section}Grid`);
                            if (el) el.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 30px; color: var(--text-muted);">No creators assigned to <strong>${productName}</strong></div>`;
                        });
                        updatePostingStats();
                        return;
                    }
                    renderPostingEmpty();
                    return;
                }
                
                // Calculate rolling 7-day and previous 7-day boundaries
                // Exclude today since we never have same-day data
                const today = new Date();
                const localDateStrFn = (d) => d.toISOString().split('T')[0];
                
                // Last 7 days: yesterday back to 7 days ago
                const yesterday = new Date(today);
                yesterday.setDate(today.getDate() - 1);
                const yesterdayStr = localDateStrFn(yesterday);
                
                const sevenDaysAgo = new Date(today);
                sevenDaysAgo.setDate(today.getDate() - 7);
                const sevenDaysAgoStr = localDateStrFn(sevenDaysAgo);
                
                // Previous 7 days: 8-14 days ago
                const eightDaysAgo = new Date(today);
                eightDaysAgo.setDate(today.getDate() - 8);
                const eightDaysAgoStr = localDateStrFn(eightDaysAgo);
                
                const fourteenDaysAgo = new Date(today);
                fourteenDaysAgo.setDate(today.getDate() - 14);
                const fourteenDaysAgoStr = localDateStrFn(fourteenDaysAgo);
                
                // Update context display
                const rangeStart = sevenDaysAgo.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                const rangeEnd = yesterday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                
                // Show product in context if selected
                let contextText = `Rolling 7 days: ${rangeStart} - ${rangeEnd}`;
                if (selectedProduct !== 'all') {
                    const productSelect = document.getElementById('postingProductFilter');
                    const productName = productSelect.options[productSelect.selectedIndex]?.textContent || selectedProduct;
                    contextText += ` • <span style="color: var(--accent);">Assigned to ${productName}</span>`;
                }
                document.getElementById('postingWeekContext').innerHTML = contextText;
                
                // Fetch creator_performance data for last 14 days
                // This includes GMV and the 'videos' column which is our source of truth for post counts
                let perfQuery = supabaseClient
                    .from('creator_performance')
                    .select('creator_name, brand, gmv, videos, report_date')
                    .gte('report_date', fourteenDaysAgoStr)
                    .lte('report_date', yesterdayStr)
                    .limit(50000);
                
                if (selectedBrand !== 'all') {
                    perfQuery = perfQuery.eq('brand', selectedBrand);
                }
                
                // Fetch contact log for last contact dates
                let contactQuery = supabaseClient
                    .from('contact_log')
                    .select('creator_id, creator_name, brand, contact_date')
                    .order('contact_date', { ascending: false });
                
                const [perfResult, contactResult] = await Promise.all([perfQuery, contactQuery]);
                
                if (perfResult.error) throw perfResult.error;
                
                const perfData = perfResult.data || [];
                const contactData = contactResult.data || [];
                
                // If product filter is active, fetch product-specific GMV from video_performance
                let productGmvMap = {};
                let productVideoCountMap = {};
                if (selectedProduct !== 'all') {
                    // Get product_ids for this product_key
                    const products = await loadProductsCache();
                    const product = products.find(p => p.product_key === selectedProduct);
                    const productIds = product?.product_ids || [];
                    
                    if (productIds.length > 0) {
                        // Convert to strings for comparison
                        const productIdStrings = productIds.map(id => String(id));
                        
                        let videoQuery = supabaseClient
                            .from('video_performance')
                            .select('creator_name, brand, gmv, product_id, video_id, report_date')
                            .gte('report_date', sevenDaysAgoStr)
                            .lte('report_date', yesterdayStr)
                            .in('product_id', productIdStrings)
                            .limit(50000);
                        
                        if (selectedBrand !== 'all') {
                            videoQuery = videoQuery.eq('brand', selectedBrand);
                        }
                        
                        const { data: videoData, error: videoError } = await videoQuery;
                        
                        if (!videoError && videoData) {
                            // Group by creator to get product-specific GMV
                            const videosByCreator = {};
                            videoData.forEach(v => {
                                const key = `${v.creator_name.toLowerCase()}|${v.brand}`;
                                if (!videosByCreator[key]) videosByCreator[key] = new Set();
                                videosByCreator[key].add(v.report_date + '|' + (v.video_id || Math.random()));
                                
                                if (!productGmvMap[key]) productGmvMap[key] = 0;
                                productGmvMap[key] += pFloat(v.gmv);
                            });
                            // Count unique videos per creator
                            Object.entries(videosByCreator).forEach(([key, videos]) => {
                                productVideoCountMap[key] = videos.size;
                            });
                        }
                    }
                }
                
                // Build contact date map (latest contact per creator)
                const contactMap = {};
                contactData.forEach(c => {
                    const key = c.creator_id || `${(c.creator_name || '').toLowerCase()}|${c.brand}`;
                    if (!contactMap[key]) contactMap[key] = c.contact_date;
                });
                
                // Build maps from creator_performance data
                // GMV, videos (posts), and last post date
                const gmvMap = {};         // Total GMV in last 7 days
                const posts7dMap = {};     // Sum of videos column in last 7 days
                const postsPrev7dMap = {}; // Sum of videos column in previous 7 days
                const lastPostMap = {};    // Most recent date where videos > 0
                const dailyPostsMap = {};  // Daily breakdown: { "creator|brand": { "2025-12-15": 5, ... } }
                
                perfData.forEach(row => {
                    const key = `${row.creator_name.toLowerCase()}|${row.brand}`;
                    const date = row.report_date;
                    const videos = parseInt(row.videos) || 0;
                    const gmv = pFloat(row.gmv);
                    
                    // Sum GMV for last 7 days only (yesterday back to 7 days ago)
                    if (date >= sevenDaysAgoStr && date <= yesterdayStr) {
                        if (!gmvMap[key]) gmvMap[key] = 0;
                        gmvMap[key] += gmv;
                        
                        // Sum videos for last 7 days
                        if (!posts7dMap[key]) posts7dMap[key] = 0;
                        posts7dMap[key] += videos;
                        
                        // Track daily breakdown
                        if (!dailyPostsMap[key]) dailyPostsMap[key] = {};
                        dailyPostsMap[key][date] = (dailyPostsMap[key][date] || 0) + videos;
                    }
                    
                    // Sum videos for previous 7 days (8-14 days ago)
                    if (date >= fourteenDaysAgoStr && date <= eightDaysAgoStr) {
                        if (!postsPrev7dMap[key]) postsPrev7dMap[key] = 0;
                        postsPrev7dMap[key] += videos;
                    }
                    
                    // Track most recent date where videos > 0
                    if (videos > 0 && (!lastPostMap[key] || date > lastPostMap[key])) {
                        lastPostMap[key] = date;
                    }
                });
                
                // Build posting data for all creators
                postingData = allCreators.map(c => {
                    const accounts = [c.account_1, c.account_2, c.account_3, c.account_4, c.account_5,
                                      c.account_6, c.account_7, c.account_8, c.account_9, c.account_10].filter(a => a && a.trim());
                    let totalGmv = 0;
                    let posts7d = 0;
                    let postsPrev7d = 0;
                    let lastPostDate = null;
                    let dailyPosts = {}; // Merged daily breakdown across all accounts
                    let productGmv = 0;  // Product-specific GMV if product filter active
                    let productVideos = 0; // Product-specific video count
                    
                    accounts.forEach(acc => {
                        const key = `${acc.toLowerCase()}|${c.brand}`;
                        totalGmv += gmvMap[key] || 0;
                        posts7d += posts7dMap[key] || 0;
                        postsPrev7d += postsPrev7dMap[key] || 0;
                        
                        // Add product-specific stats
                        productGmv += productGmvMap[key] || 0;
                        productVideos += productVideoCountMap[key] || 0;
                        
                        if (lastPostMap[key] && (!lastPostDate || lastPostMap[key] > lastPostDate)) {
                            lastPostDate = lastPostMap[key];
                        }
                        
                        // Merge daily posts from this account
                        if (dailyPostsMap[key]) {
                            Object.entries(dailyPostsMap[key]).forEach(([date, count]) => {
                                dailyPosts[date] = (dailyPosts[date] || 0) + count;
                            });
                        }
                    });
                    
                    // Detect burst posting (5+ videos in a single day)
                    let maxDailyPosts = 0;
                    let burstDate = null;
                    let daysWithPosts = 0;
                    Object.entries(dailyPosts).forEach(([date, count]) => {
                        if (count > 0) daysWithPosts++;
                        if (count > maxDailyPosts) {
                            maxDailyPosts = count;
                            burstDate = date;
                        }
                    });
                    
                    // Flag suspicious patterns
                    const isBurstPosting = maxDailyPosts >= 5;
                    const isUnevenPosting = posts7d >= 7 && daysWithPosts <= 2; // Many posts but only 1-2 days
                    
                    // Check if on retainer
                    const isRetainer = hasAnyRetainer(c);
                    const totalRetainer = getTotalRetainer(c);
                    
                    // Determine status based on video count in last 7 days
                    // 0 = ghost, 1-3 = behind, 4-5 = atrisk, 6-9 = ontrack, 10+ = stars
                    let status = 'ontrack';
                    if (posts7d === 0) status = 'ghost';
                    else if (posts7d <= 3) status = 'behind';
                    else if (posts7d <= 5) status = 'atrisk';
                    else if (posts7d >= 10) status = 'stars';
                    
                    // Check if trending down (fewer posts than previous 7 days)
                    const isTrendingDown = postsPrev7d > 0 && posts7d < postsPrev7d;
                    
                    // Get last contact from database
                    const contactKey = c.id || `${(c.account_1 || '').toLowerCase()}|${c.brand}`;
                    const lastContact = contactMap[c.id] || contactMap[contactKey] || c.last_contact_date || null;
                    
                    // Days since last post
                    let daysSincePost = null;
                    if (lastPostDate) {
                        const lpd = new Date(lastPostDate + 'T00:00:00');
                        daysSincePost = Math.floor((today - lpd) / (1000 * 60 * 60 * 24));
                    }
                    
                    // Calculate ROI
                    // When product filter is active, use product-specific GMV and retainer
                    let roi = null;
                    let effectiveRetainer = totalRetainer;
                    let effectiveGmv = totalGmv;
                    
                    if (selectedProduct !== 'all') {
                        // Use product-specific retainer if exists
                        const productRetainerAmount = (c.product_retainers || {})[selectedProduct] || 0;
                        if (productRetainerAmount > 0) {
                            effectiveRetainer = productRetainerAmount;
                        }
                        effectiveGmv = productGmv;
                    }
                    
                    if (effectiveRetainer > 0) {
                        roi = effectiveGmv / effectiveRetainer;
                    }
                    
                    // Check if this creator has a product-specific retainer
                    const hasProductRetainer = selectedProduct !== 'all' && (c.product_retainers || {})[selectedProduct] > 0;
                    
                    // Calculate priority score (higher = more urgent)
                    let priority = 0;
                    if (isRetainer || hasProductRetainer) priority += 100;
                    if (status === 'ghost') priority += 60;
                    else if (status === 'behind') priority += 40;
                    else if (status === 'atrisk') priority += 20;
                    if (isTrendingDown) priority += 15;
                    if (isBurstPosting || isUnevenPosting) priority += 25; // Flag suspicious patterns
                    priority += effectiveRetainer / 50;
                    
                    return {
                        id: c.id,
                        name: c.real_name || c.discord_name || c.account_1,
                        handle: c.account_1,
                        accounts: accounts,
                        brand: c.brand,
                        isRetainer: isRetainer || hasProductRetainer,
                        retainer: totalRetainer,
                        effectiveRetainer: effectiveRetainer,
                        gmv: totalGmv,
                        effectiveGmv: effectiveGmv,
                        productGmv: productGmv,
                        productVideos: productVideos,
                        hasProductActivity: selectedProduct !== 'all' && (productGmv > 0 || productVideos > 0),
                        hasProductRetainer: hasProductRetainer,
                        roi: roi,
                        posts7d: posts7d,
                        postsPrev7d: postsPrev7d,
                        dailyPosts: dailyPosts,
                        maxDailyPosts: maxDailyPosts,
                        burstDate: burstDate,
                        daysWithPosts: daysWithPosts,
                        isBurstPosting: isBurstPosting,
                        isUnevenPosting: isUnevenPosting,
                        status: status,
                        isTrendingDown: isTrendingDown,
                        lastContact: lastContact,
                        lastPostDate: lastPostDate,
                        daysSincePost: daysSincePost,
                        discordChannelId: c.discord_channel_id,
                        productRetainers: c.product_retainers || {},
                        priority: priority
                    };
                });
                
                // Store filter state for card rendering
                window.postingProductFilter = selectedProduct !== 'all';
                window.postingSelectedProduct = selectedProduct;
                
                // Sort by priority (highest first)
                postingData.sort((a, b) => b.priority - a.priority);
                
                filterPostingData();
                window.postingDataLoaded = true;
                
            } catch (err) {
                console.error('Error loading posting data:', err);
                const sections = ['Ghosts', 'Behind', 'Atrisk', 'Ontrack', 'Stars'];
                sections.forEach(section => {
                    const el = document.getElementById(`posting${section}Grid`);
                    if (el) el.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 30px; color: var(--danger);">Error: ${err.message}</div>`;
                });
            }
        }
        
        function renderPostingEmpty() {
            const sections = ['Ghosts', 'Behind', 'Atrisk', 'Ontrack', 'Stars'];
            sections.forEach(section => {
                const el = document.getElementById(`posting${section}Grid`);
                if (el) el.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 30px; color: var(--text-muted);">No creators found</div>';
            });
            updatePostingStats();
        }
        
        function filterPostingData() {
            const creatorType = document.getElementById('postingTypeFilter')?.value || 'all';
            const search = document.getElementById('postingSearchFilter')?.value?.toLowerCase() || '';
            const hideContacted = document.getElementById('postingHideContacted')?.checked || false;
            
            postingFiltered = postingData.filter(c => {
                if (creatorType === 'retainer' && !c.isRetainer) return false;
                if (creatorType === 'affiliate' && c.isRetainer) return false;
                if (creatorType === 'pcfiber') {
                    // PC Fiber = Physicians Choice with pc_fiber product retainer
                    const isPCFiber = c.brand === 'physicians_choice' && c.productRetainers && c.productRetainers['pc_fiber'] > 0;
                    if (!isPCFiber) return false;
                }
                if (search && !c.name.toLowerCase().includes(search) && !c.handle?.toLowerCase().includes(search)) return false;
                
                // Hide recently contacted (within last 2 days)
                if (hideContacted && c.lastContact) {
                    const contactDate = new Date(c.lastContact);
                    const daysSinceContact = Math.floor((new Date() - contactDate) / (1000 * 60 * 60 * 24));
                    if (daysSinceContact <= 1) return false;
                }
                
                return true;
            });
            
            // Categorize into sections
            postingCategories = {
                ghosts: postingFiltered.filter(c => c.status === 'ghost').sort((a, b) => b.priority - a.priority),
                behind: postingFiltered.filter(c => c.status === 'behind').sort((a, b) => b.priority - a.priority),
                atrisk: postingFiltered.filter(c => c.status === 'atrisk').sort((a, b) => b.priority - a.priority),
                ontrack: postingFiltered.filter(c => c.status === 'ontrack').sort((a, b) => b.posts7d - a.posts7d),
                stars: postingFiltered.filter(c => c.status === 'stars').sort((a, b) => b.posts7d - a.posts7d)
            };
            
            updatePostingStats();
            renderPostingCards();
        }
        
        function updatePostingStats() {
            const ghosts = postingCategories.ghosts?.length || 0;
            const behind = postingCategories.behind?.length || 0;
            const atrisk = postingCategories.atrisk?.length || 0;
            const ontrack = postingCategories.ontrack?.length || 0;
            const stars = postingCategories.stars?.length || 0;
            
            // Calculate retainer at risk (retainer $ for underperforming creators)
            const underperformers = [...(postingCategories.ghosts || []), ...(postingCategories.behind || []), ...(postingCategories.atrisk || [])];
            const atRiskCreators = underperformers.filter(c => c.isRetainer);
            const retainerAtRisk = atRiskCreators.reduce((sum, c) => sum + c.retainer, 0);
            
            // Update stat cards
            document.getElementById('postingGhostsCount').textContent = ghosts;
            document.getElementById('postingBehindCount').textContent = behind;
            document.getElementById('postingAtRiskCount').textContent = atrisk;
            document.getElementById('postingOnTrackCount').textContent = ontrack;
            document.getElementById('postingStarsCount').textContent = stars;
            document.getElementById('postingRetainerAtRisk').textContent = fmtMoney(retainerAtRisk);
            document.getElementById('postingAtRiskRetainerCount').textContent = `${atRiskCreators.length} creator${atRiskCreators.length !== 1 ? 's' : ''}`;
            
            // Update section badges
            document.getElementById('postingGhostsBadge').textContent = ghosts;
            document.getElementById('postingBehindBadge').textContent = behind;
            document.getElementById('postingAtriskBadge').textContent = atrisk;
            document.getElementById('postingOntrackBadge').textContent = ontrack;
            document.getElementById('postingStarsBadge').textContent = stars;
            
            // Update morning briefing if visible
            const briefingGhosts = document.getElementById('briefingGhosts');
            const briefingBehind = document.getElementById('briefingBehind');
            if (briefingGhosts) briefingGhosts.textContent = ghosts;
            if (briefingBehind) briefingBehind.textContent = behind;
        }
        
        function renderPostingCards() {
            // Render each section with appropriate styling
            renderPostingSection('Ghosts', postingCategories.ghosts || [], '#6b7280', '👻');
            renderPostingSection('Behind', postingCategories.behind || [], '#ef4444', '🚨');
            renderPostingSection('Atrisk', postingCategories.atrisk || [], '#f59e0b', '⚠️');
            renderPostingSection('Ontrack', postingCategories.ontrack || [], '#22c55e', '✅');
            renderPostingSection('Stars', postingCategories.stars || [], '#8b5cf6', '⭐');
        }
        
        function renderPostingSection(sectionName, creators, accentColor, emoji) {
            const container = document.getElementById(`posting${sectionName}Grid`);
            if (!container) return;
            
            if (creators.length === 0) {
                const emptyMessages = {
                    'Ghosts': '✅ No ghost creators - everyone is posting!',
                    'Behind': '✅ No one behind on posting!',
                    'Atrisk': '✅ No at-risk creators!',
                    'Ontrack': 'No on-track creators found',
                    'Stars': 'No star performers yet'
                };
                container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 30px; color: var(--text-muted);">${emptyMessages[sectionName] || 'No creators'}</div>`;
                return;
            }
            
            container.innerHTML = creators.map(c => renderPostingCard(c, accentColor, sectionName)).join('');
        }
        
        function renderPostingCard(c, accentColor, sectionName) {
            // Check if PC Fiber creator (has product retainer for pc_fiber)
            const isPCFiber = c.brand === 'physicians_choice' && c.productRetainers && c.productRetainers['pc_fiber'] > 0;
            const fiberBadge = isPCFiber ? '<span style="background: #10b981; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.6rem; font-weight: 600;">FIBER</span>' : '';
            
            // Product assignment pills (show what products they're assigned to)
            const productPills = getProductAssignmentPills(c.productRetainers ? { product_retainers: c.productRetainers } : c, 2);
            
            // Last post display
            let lastPostDisplay = '<span style="color: var(--danger);">Never</span>';
            if (c.daysSincePost !== null) {
                if (c.daysSincePost === 0) lastPostDisplay = '<span style="color: var(--success);">Today</span>';
                else if (c.daysSincePost === 1) lastPostDisplay = '<span style="color: var(--success);">Yesterday</span>';
                else if (c.daysSincePost <= 3) lastPostDisplay = `<span style="color: var(--success);">${c.daysSincePost}d ago</span>`;
                else if (c.daysSincePost <= 7) lastPostDisplay = `<span style="color: var(--warning);">${c.daysSincePost}d ago</span>`;
                else lastPostDisplay = `<span style="color: var(--danger);">${c.daysSincePost}d ago</span>`;
            }
            
            // Last contact display
            let lastContactDisplay = '<span style="color: var(--text-muted);">Never</span>';
            if (c.lastContact) {
                const contactDate = new Date(c.lastContact);
                const daysSince = Math.floor((new Date() - contactDate) / (1000 * 60 * 60 * 24));
                if (daysSince === 0) lastContactDisplay = '<span style="color: var(--success);">Today</span>';
                else if (daysSince === 1) lastContactDisplay = '<span style="color: var(--success);">Yesterday</span>';
                else if (daysSince < 7) lastContactDisplay = `<span style="color: var(--success);">${daysSince}d ago</span>`;
                else lastContactDisplay = `<span style="color: var(--warning);">${daysSince}d ago</span>`;
            }
            
            // ROI display
            let roiDisplay = '--';
            let roiColor = 'var(--text-muted)';
            if (c.isRetainer && c.roi !== null) {
                roiDisplay = c.roi.toFixed(1) + 'x';
                roiColor = c.roi >= 2 ? 'var(--success)' : c.roi >= 1 ? 'var(--warning)' : 'var(--danger)';
            }
            
            // Discord button
            const discordBtn = c.discordChannelId 
                ? `<button onclick="openDiscordChannel('${c.brand}', '${c.discordChannelId}')" class="btn btn-sm" style="background: #5865F2; color: white; padding: 5px 10px; font-size: 0.7rem;">💬</button>`
                : '';
            
            // Posts display color (based on count: 0=gray, 1-3=red, 4-5=orange, 6-9=green, 10+=purple)
            const posts = c.posts7d || 0;
            const postsColor = posts >= 10 ? '#8b5cf6' : posts >= 6 ? '#22c55e' : posts >= 4 ? '#f59e0b' : posts > 0 ? '#ef4444' : '#6b7280';
            
            // Recently contacted indicator (green checkmark if contacted in last 2 days)
            let recentlyContacted = false;
            let contactedBadge = '';
            if (c.lastContact) {
                const contactDate = new Date(c.lastContact);
                const daysSinceContact = Math.floor((new Date() - contactDate) / (1000 * 60 * 60 * 24));
                if (daysSinceContact <= 1) {
                    recentlyContacted = true;
                    contactedBadge = '<span style="background: #22c55e; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.6rem; font-weight: 600;">✓ Contacted</span>';
                }
            }
            
            // Burst/uneven posting warning badge
            let warningBadge = '';
            if (c.isBurstPosting) {
                warningBadge = `<span style="background: #ef4444; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.6rem; font-weight: 600;" title="${c.maxDailyPosts} videos on ${c.burstDate}">🚨 BURST</span>`;
            } else if (c.isUnevenPosting) {
                warningBadge = `<span style="background: #f59e0b; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.6rem; font-weight: 600;" title="${posts} videos in only ${c.daysWithPosts} days">⚠️ UNEVEN</span>`;
            }
            
            // Trending down badge
            let trendingBadge = '';
            if (c.isTrendingDown) {
                trendingBadge = `<span style="background: #ec4899; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.6rem; font-weight: 600;" title="${c.postsPrev7d}→${c.posts7d} posts vs last week">📉 ${c.postsPrev7d}→${c.posts7d}</span>`;
            }
            
            // Product activity badge (when product filter is active)
            let productBadge = '';
            if (window.postingProductFilter) {
                if (c.hasProductActivity) {
                    productBadge = `<span style="background: #8b5cf6; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.6rem; font-weight: 600;" title="${c.productVideos} videos, ${fmtMoney(c.productGmv)} GMV">📦 ${c.productVideos} vid${c.productVideos !== 1 ? 's' : ''}</span>`;
                } else {
                    productBadge = `<span style="background: #6b7280; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.6rem; font-weight: 600;">No product sales</span>`;
                }
            }
            
            // Build daily breakdown display (mini bar chart)
            const dailyBreakdownId = `daily-${c.id}`;
            let dailyBars = '';
            if (c.dailyPosts && Object.keys(c.dailyPosts).length > 0) {
                // Get last 7 days in order
                const dates = [];
                for (let i = 7; i >= 1; i--) {
                    const d = new Date();
                    d.setDate(d.getDate() - i);
                    dates.push(d.toISOString().split('T')[0]);
                }
                
                const maxVal = Math.max(...Object.values(c.dailyPosts), 1);
                dailyBars = dates.map(date => {
                    const count = c.dailyPosts[date] || 0;
                    const height = count > 0 ? Math.max(4, (count / maxVal) * 24) : 2;
                    const dayName = new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' }).charAt(0);
                    const barColor = count >= 5 ? '#ef4444' : count > 0 ? '#22c55e' : '#374151';
                    return `<div style="display: flex; flex-direction: column; align-items: center; gap: 2px;">
                        <div style="width: 12px; height: ${height}px; background: ${barColor}; border-radius: 2px;" title="${date}: ${count} videos"></div>
                        <span style="font-size: 0.5rem; color: var(--text-muted);">${dayName}</span>
                    </div>`;
                }).join('');
            }
            
            return `
            <div style="background: var(--bg-secondary); border-radius: 10px; padding: 14px; border: 1px solid var(--border); border-left: 4px solid ${accentColor}; ${recentlyContacted ? 'opacity: 0.6;' : ''} transition: transform 0.15s, box-shadow 0.15s;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.15)'; this.style.opacity='1';" onmouseout="this.style.transform=''; this.style.boxShadow=''; ${recentlyContacted ? "this.style.opacity='0.6';" : ''}">
                <div style="display: flex; justify-content: space-between; align-items: start; gap: 12px;">
                    <!-- Left: Creator Info -->
                    <div style="flex: 1; min-width: 0;">
                        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px; flex-wrap: wrap;">
                            <span style="font-weight: 700; font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${sanitize(c.name)}</span>
                            ${c.isRetainer ? `<span style="background: ${c.hasProductRetainer ? '#8b5cf6' : 'var(--accent)'}; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.6rem; font-weight: 600;" title="${c.hasProductRetainer ? 'Product retainer' : 'Base retainer'}">${fmtMoney(c.effectiveRetainer || c.retainer)}${c.hasProductRetainer ? ' 📦' : ''}</span>` : ''}
                            ${fiberBadge}
                            ${productPills ? `<span style="display: inline-flex; gap: 4px; align-items: center;">${productPills}</span>` : ''}
                            ${productBadge}
                            ${warningBadge}
                            ${trendingBadge}
                            ${contactedBadge}
                        </div>
                        <div style="display: flex; flex-wrap: wrap; gap: 6px; font-size: 0.75rem; color: var(--text-muted); margin-bottom: 8px;">
                            <a href="https://www.tiktok.com/@${c.handle}" target="_blank" style="color: var(--blue); text-decoration: none;">@${c.handle}</a>
                            <span>•</span>
                            <span class="badge-brand" style="font-size: 0.65rem;">${BRAND_DISPLAY[c.brand] || c.brand}</span>
                        </div>
                        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; font-size: 0.7rem; margin-top: 6px;">
                            <div><span style="color: var(--text-muted);">Last Post:</span> ${lastPostDisplay}</div>
                            <div><span style="color: var(--text-muted);">Contact:</span> ${lastContactDisplay}</div>
                            <div><span style="color: var(--text-muted);">${window.postingProductFilter ? 'Product GMV:' : 'GMV:'}</span> <span style="color: var(--success);">${fmtMoney(window.postingProductFilter ? c.productGmv : c.gmv)}</span>${window.postingProductFilter && c.gmv > 0 ? ` <span style="color: var(--text-muted); font-size: 0.6rem;">(${fmtMoney(c.gmv)} total)</span>` : ''}</div>
                            <div><span style="color: var(--text-muted);">ROI:</span> <span style="color: ${roiColor};">${roiDisplay}</span></div>
                        </div>
                    </div>
                    
                    <!-- Right: Posts + Daily Breakdown + Actions -->
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 6px;">
                        <div style="text-align: center;">
                            <div style="font-size: 1.6rem; font-weight: 800; color: ${postsColor}; line-height: 1;">${posts}</div>
                            <div style="font-size: 0.55rem; color: var(--text-muted);">posts (${c.daysWithPosts || 0} days)</div>
                        </div>
                        ${dailyBars ? `<div style="display: flex; gap: 3px; align-items: flex-end; height: 32px;">${dailyBars}</div>` : ''}
                        <div style="display: flex; gap: 4px;">
                            ${discordBtn}
                            <button onclick="markContacted('${c.handle?.toLowerCase()}|${c.brand}')" class="btn btn-sm" style="padding: 5px 10px; font-size: 0.7rem;" title="Log Contact">📞</button>
                            <button onclick="editCreator(${c.id})" class="btn btn-sm" style="padding: 5px 10px; font-size: 0.7rem;" title="Edit">✏️</button>
                            <button onclick="removeFromRoster(${c.id}, '${sanitize(c.name)}')" class="btn btn-sm" style="padding: 5px 10px; font-size: 0.7rem; background: var(--danger); color: white;" title="Remove from Roster">🗑️</button>
                        </div>
                    </div>
                </div>
            </div>`;
        }
        
        // Open Discord channel directly
        function openDiscordChannel(brand, channelId) {
            const serverId = DISCORD_SERVERS[brand];
            if (!serverId) {
                showToast('Discord server not configured for this brand', 'warning');
                return;
            }
            window.open(`https://discord.com/channels/${serverId}/${channelId}`, '_blank');
        }
        
        // Remove creator from managed roster
        async function removeFromRoster(creatorId, creatorName) {
            if (!confirm(`Remove "${creatorName}" from the managed roster?\n\nThis will set their status to Inactive. They can be re-added later if needed.`)) {
                return;
            }
            
            try {
                const { error } = await supabaseClient
                    .from('managed_creators')
                    .update({ status: 'Inactive' })
                    .eq('id', creatorId);
                
                if (error) throw error;
                
                showToast(`${creatorName} removed from roster`, 'success');
                
                // Remove from local data and re-render
                postingData = postingData.filter(c => c.id !== creatorId);
                filterPostingData();
                
                // Invalidate cache so Users tab refreshes
                cache.invalidate('managed_creators');
                
            } catch (err) {
                console.error('Error removing creator:', err);
                showToast('Error: ' + err.message, 'error');
            }
        }
        
        function markContacted(creatorKey) {
            // Open the contact log modal instead of just marking contacted
            openContactLogModal(creatorKey);
        }
        
        function openContactLogModal(creatorKey) {
            // Parse the key
            const parts = creatorKey.split('|');
            const searchHandle = parts[0]?.toLowerCase();
            const searchBrand = parts[1];
            
            // Find creator data - more robust matching
            const creator = postingData.find(c => {
                const handleMatch = (c.handle || '').toLowerCase() === searchHandle;
                const brandMatch = c.brand === searchBrand;
                return handleMatch && brandMatch;
            });
            
            if (!creator) {
                console.error('Creator not found. Key:', creatorKey, 'postingData length:', postingData.length);
                // Try to find by ID from managedCreators as fallback
                const managed = managedCreators.find(m => 
                    (m.account_1 || '').toLowerCase() === searchHandle && m.brand === searchBrand
                );
                if (managed) {
                    // Build a minimal creator object from managed data
                    openContactLogModalDirect(managed, creatorKey);
                    return;
                }
                showToast('Creator not found. Try refreshing the page.', 'error');
                return;
            }
            
            openContactLogModalWithCreator(creator, creatorKey);
        }
        
        function openContactLogModalDirect(managed, creatorKey) {
            // Build creator object from managed_creators data
            const creator = {
                id: managed.id,
                name: managed.real_name || managed.discord_name || managed.account_1,
                handle: managed.account_1,
                brand: managed.brand,
                discordChannelId: managed.discord_channel_id
            };
            openContactLogModalWithCreator(creator, creatorKey);
        }
        
        function openContactLogModalWithCreator(creator, creatorKey) {
            
            // Get managed creator info for Discord channel
            const managedInfo = getManagedInfo(creator.handle);
            const channelId = creator.discordChannelId || managedInfo?.discord_channel_id || '';
            
            // Populate modal
            document.getElementById('contactCreatorId').value = creator.id || '';
            document.getElementById('contactCreatorKey').value = creatorKey;
            document.getElementById('contactCreatorBrandKey').value = creator.brand;
            document.getElementById('contactCreatorChannelId').value = channelId;
            document.getElementById('contactCreatorName').textContent = creator.name + ' (@' + (creator.handle || 'unknown') + ')';
            document.getElementById('contactCreatorBrand').textContent = BRAND_DISPLAY[creator.brand] || creator.brand;
            
            // Show/hide Discord button based on channel availability
            const discordBtn = document.getElementById('contactDiscordBtn');
            if (channelId) {
                discordBtn.style.display = 'flex';
                discordBtn.title = 'Open Discord channel';
            } else {
                discordBtn.style.display = 'none';
            }
            
            // Reset form
            document.getElementById('contactMethod').value = 'Discord';
            document.getElementById('contactType').value = 'Check-in';
            document.getElementById('contactOutcome').value = '';
            document.getElementById('contactNotes').value = '';
            document.getElementById('contactFollowup').value = '';
            document.getElementById('messagePreview').style.display = 'none';
            
            // Load contact history
            loadContactHistory(creator.id, creator.brand, creator.handle);
            
            document.getElementById('contactLogModal').classList.add('show');
        }
        
        // Open Discord from contact modal
        function openDiscordFromModal() {
            const brand = document.getElementById('contactCreatorBrandKey').value;
            const channelId = document.getElementById('contactCreatorChannelId').value;
            
            if (!channelId) {
                showToast('No Discord channel linked. Edit creator profile to add it.', 'warning');
                return;
            }
            
            const serverId = DISCORD_SERVERS[brand];
            if (!serverId) {
                showToast('Discord server not configured for this brand', 'warning');
                return;
            }
            
            // Open Discord - will work on desktop, mobile, and browser
            const url = `https://discord.com/channels/${serverId}/${channelId}`;
            window.open(url, '_blank');
        }
        
        // Message templates
        const MESSAGE_TEMPLATES = {
            checkin: `Hey! 👋 Just checking in - how's everything going? Let me know if you need any support or have questions about content!`,
            warning: `Hey! I noticed your posting has dropped off recently. Everything okay? Just wanted to check in and see if there's anything we can help with. 

We really want to see you succeed, but we do need to see more consistent content to keep the partnership going. Let me know what's going on! 🙏`,
            final: `Hey, I need to have a serious conversation with you.

We haven't seen posts from you in a while, and unfortunately we're at the point where we need to see immediate improvement or we'll have to end the partnership.

Can you post TODAY and commit to getting back on track? Please reply ASAP. 🚨`,
            praise: `Hey! 🎉 Just wanted to say you've been CRUSHING it lately! Your content is doing great and we really appreciate your consistency.

Keep up the amazing work! Let me know if there's anything you need from us. 💪`
        };
        
        function useMessageTemplate(type) {
            const creatorName = document.getElementById('contactCreatorName').textContent.split(' (@')[0];
            let message = MESSAGE_TEMPLATES[type] || '';
            
            // Show preview
            document.getElementById('messageText').textContent = message;
            document.getElementById('messagePreview').style.display = 'block';
            
            // Auto-select contact type
            const typeMap = {
                checkin: 'Check-in',
                warning: 'Warning',
                final: 'Final Notice',
                praise: 'Positive Feedback'
            };
            document.getElementById('contactType').value = typeMap[type] || 'Check-in';
        }
        
        function copyMessageToClipboard() {
            const message = document.getElementById('messageText').textContent;
            navigator.clipboard.writeText(message).then(() => {
                showToast('Message copied! Paste in Discord.', 'success');
            }).catch(() => {
                showToast('Failed to copy', 'error');
            });
        }
        
        function closeContactLogModal() {
            document.getElementById('contactLogModal').classList.remove('show');
        }
        
        async function loadContactHistory(creatorId, brand, handle) {
            const listEl = document.getElementById('contactHistoryList');
            const countEl = document.getElementById('contactHistoryCount');
            
            listEl.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-muted);">Loading...</div>';
            
            try {
                // Query by creator_id if available, otherwise by name/brand
                let query = supabaseClient.from('contact_log').select('*').order('contact_date', { ascending: false }).limit(10);
                
                if (creatorId) {
                    query = query.eq('creator_id', creatorId);
                } else {
                    query = query.eq('creator_name', handle).eq('brand', brand);
                }
                
                const { data, error } = await query;
                
                if (error) {
                    // Table might not exist yet
                    console.log('Contact log table may not exist:', error.message);
                    listEl.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-muted); font-size: 0.85rem;">No contact history (run migration to enable)</div>';
                    countEl.textContent = '0 records';
                    return;
                }
                
                if (!data || data.length === 0) {
                    listEl.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-muted); font-size: 0.85rem;">No previous contacts logged</div>';
                    countEl.textContent = '0 records';
                    return;
                }
                
                countEl.textContent = data.length + ' record' + (data.length !== 1 ? 's' : '');
                
                listEl.innerHTML = data.map(log => {
                    const date = new Date(log.contact_date);
                    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                    
                    const typeColors = {
                        'Check-in': 'var(--text-muted)',
                        'Warning': 'var(--warning)',
                        'Final Notice': 'var(--error)',
                        'Positive Feedback': 'var(--success)',
                        'Contract Discussion': 'var(--accent)'
                    };
                    const typeColor = typeColors[log.contact_type] || 'var(--text-muted)';
                    
                    const outcomeIcons = {
                        'No Response': '⏳',
                        'Acknowledged': '👍',
                        'Committed to Improve': '💪',
                        'Excuse Given': '🤷',
                        'Dispute': '⚡',
                        'Positive': '🎉'
                    };
                    const outcomeIcon = outcomeIcons[log.outcome] || '';
                    
                    return `
                        <div style="padding: 10px; border: 1px solid var(--border); border-radius: 6px; margin-bottom: 8px; font-size: 0.85rem;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                                <span style="font-weight: 600; color: ${typeColor};">${log.contact_type}</span>
                                <span style="color: var(--text-muted); font-size: 0.75rem;">${dateStr} ${timeStr}</span>
                            </div>
                            <div style="display: flex; gap: 12px; color: var(--text-muted); font-size: 0.8rem; margin-bottom: 4px;">
                                <span>📱 ${log.contact_method}</span>
                                ${log.outcome ? `<span>${outcomeIcon} ${log.outcome}</span>` : ''}
                            </div>
                            ${log.notes ? `<div style="color: var(--text-secondary); font-size: 0.8rem; margin-top: 6px; padding-top: 6px; border-top: 1px solid var(--border);">${log.notes}</div>` : ''}
                            ${log.followup_date && !log.followup_completed ? `<div style="color: var(--warning); font-size: 0.75rem; margin-top: 6px;">📅 Follow-up: ${new Date(log.followup_date).toLocaleDateString()}</div>` : ''}
                        </div>
                    `;
                }).join('');
                
            } catch (err) {
                console.error('Error loading contact history:', err);
                listEl.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-muted); font-size: 0.85rem;">Error loading history</div>';
            }
        }
        
        async function saveContactLog() {
            const creatorId = document.getElementById('contactCreatorId').value;
            const creatorKey = document.getElementById('contactCreatorKey').value;
            const method = document.getElementById('contactMethod').value;
            const type = document.getElementById('contactType').value;
            const outcome = document.getElementById('contactOutcome').value;
            const notes = document.getElementById('contactNotes').value.trim();
            const followup = document.getElementById('contactFollowup').value;
            
            // Parse the key and find creator
            const parts = creatorKey.split('|');
            const searchHandle = parts[0]?.toLowerCase();
            const searchBrand = parts[1];
            
            // Find creator for name/brand - match on handle and brand
            let creator = postingData.find(c => 
                (c.handle || '').toLowerCase() === searchHandle && c.brand === searchBrand
            );
            
            // Fallback to managedCreators if not found in postingData
            if (!creator) {
                const managed = managedCreators.find(m => 
                    (m.account_1 || '').toLowerCase() === searchHandle && m.brand === searchBrand
                );
                if (managed) {
                    creator = {
                        id: managed.id,
                        handle: managed.account_1,
                        name: managed.real_name || managed.discord_name || managed.account_1,
                        brand: managed.brand
                    };
                }
            }
            
            if (!creator) {
                showToast('Creator not found. Try refreshing the page.', 'error');
                return;
            }
            
            try {
                // Save to database
                const { error } = await supabaseClient.from('contact_log').insert({
                    creator_id: creatorId ? parseInt(creatorId) : null,
                    creator_name: creator.handle || creator.name,
                    brand: creator.brand,
                    contact_method: method,
                    contact_type: type,
                    outcome: outcome || null,
                    notes: notes || null,
                    followup_date: followup || null,
                    logged_by: adminName || 'Admin'
                });
                
                if (error) {
                    // If table doesn't exist, fall back to localStorage
                    console.log('Falling back to localStorage:', error.message);
                    const today = new Date().toISOString();
                    postingContactLog[creatorKey] = today;
                    saveContactLog_localStorage();
                    showToast('Contact logged (local only - run migration for full features)', 'warning');
                } else {
                    showToast('Contact logged successfully! ✅', 'success');
                }
                
                // Also update localStorage for quick "last contact" display
                postingContactLog[creatorKey] = new Date().toISOString().split('T')[0];
                saveContactLog_localStorage();
                
                // Update the posting data
                postingData = postingData.map(c => {
                    const cKey = `${(c.handle || '').toLowerCase()}|${c.brand}`;
                    if (cKey === creatorKey) {
                        c.lastContact = new Date().toISOString().split('T')[0];
                        c.needsContact = false;
                    }
                    return c;
                });
                
                closeContactLogModal();
                filterPostingData();
                
            } catch (err) {
                console.error('Error saving contact:', err);
                showToast('Error: ' + err.message, 'error');
            }
        }
        
        // Rename localStorage functions to avoid conflict
        function saveContactLog_localStorage() {
            try {
                localStorage.setItem('creatorContactLog', JSON.stringify(postingContactLog));
            } catch (e) {
                console.error('Error saving contact log:', e);
            }
        }
        
        // ==================== END POSTING ACCOUNTABILITY ====================
        
        // ==================== PRODUCTS MANAGER ====================
        let productsData = [];
        
        async function loadProducts() {
            const tbody = document.getElementById('productsTableBody');
            if (!tbody) return;
            
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--text-muted);"><div class="spinner" style="margin: 0 auto 12px;"></div>Loading products...</td></tr>';
            
            try {
                const brandFilter = document.getElementById('productsFilterBrand')?.value || '';
                
                let query = supabaseClient.from('products').select('*').order('brand').order('display_name');
                
                if (brandFilter) {
                    query = query.eq('brand', brandFilter);
                }
                
                const { data, error } = await query;
                
                if (error) throw error;
                
                productsData = data || [];
                
                if (productsData.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--text-muted);">No products defined yet. Click "Add Product Group" to create one.</td></tr>';
                    return;
                }
                
                tbody.innerHTML = productsData.map(p => {
                    const productIdCount = (p.product_ids || []).length;
                    const statusBadge = p.status === 'active' 
                        ? '<span style="background: var(--success-dim); color: var(--success); padding: 2px 8px; border-radius: 4px; font-size: 0.7rem;">Active</span>'
                        : '<span style="background: var(--error-dim); color: var(--error); padding: 2px 8px; border-radius: 4px; font-size: 0.7rem;">Inactive</span>';
                    
                    return `
                        <tr>
                            <td><code style="background: var(--bg-secondary); padding: 2px 6px; border-radius: 4px; font-size: 0.8rem;">${p.product_key}</code></td>
                            <td style="font-weight: 600;">${p.display_name}</td>
                            <td><span class="badge-brand">${BRAND_DISPLAY[p.brand] || p.brand}</span></td>
                            <td style="text-align: center;">${productIdCount} ID${productIdCount !== 1 ? 's' : ''}</td>
                            <td style="text-align: center;">${statusBadge}</td>
                            <td style="text-align: center;">
                                <button class="btn btn-sm" onclick="editProduct('${p.id}')" style="padding: 4px 8px; font-size: 0.7rem;">✏️</button>
                                <button class="btn btn-sm" onclick="deleteProduct('${p.id}')" style="padding: 4px 8px; font-size: 0.7rem; color: var(--error);">🗑️</button>
                            </td>
                        </tr>
                    `;
                }).join('');
                
            } catch (err) {
                console.error('Error loading products:', err);
                tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--error);">Error: ${err.message}</td></tr>`;
            }
        }
        
        // ==================== SETTINGS PRODUCTS FROM DATA ====================
        let settingsProductsData = [];
        let settingsProductsSortField = 'gmv';
        let settingsProductsSortAsc = false;
        
        async function loadSettingsProducts() {
            const tbody = document.getElementById('settingsProductsTableBody');
            if (!tbody) return;
            
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--text-muted);"><div class="spinner" style="margin: 0 auto 12px;"></div>Loading products from data...</td></tr>';
            
            try {
                // Get last 30 days
                const today = new Date();
                const thirtyDaysAgo = new Date(today);
                thirtyDaysAgo.setDate(today.getDate() - 30);
                const startDate = localDateStr(thirtyDaysAgo);
                const endDate = localDateStr(today);
                
                // Query video_performance for product stats
                const { data, error } = await supabaseClient
                    .from('video_performance')
                    .select('product_name, brand, gmv, orders, video_id')
                    .gte('report_date', startDate)
                    .lte('report_date', endDate)
                    .not('product_name', 'is', null);
                
                if (error) throw error;
                
                // Aggregate by product_name + brand
                const productMap = {};
                (data || []).forEach(row => {
                    if (!row.product_name || !row.product_name.trim()) return;
                    const key = `${row.product_name}|${row.brand}`;
                    if (!productMap[key]) {
                        productMap[key] = {
                            name: row.product_name,
                            brand: row.brand,
                            gmv: 0,
                            orders: 0,
                            videoIds: new Set()
                        };
                    }
                    productMap[key].gmv += row.gmv || 0;
                    productMap[key].orders += row.orders || 0;
                    if (row.video_id) productMap[key].videoIds.add(row.video_id);
                });
                
                // Convert to array
                settingsProductsData = Object.values(productMap).map(p => ({
                    ...p,
                    videos: p.videoIds.size,
                    avgPerVideo: p.videoIds.size > 0 ? p.gmv / p.videoIds.size : 0
                }));
                
                // Update stats
                const totalProducts = settingsProductsData.length;
                const totalGmv = settingsProductsData.reduce((sum, p) => sum + p.gmv, 0);
                const totalVideos = settingsProductsData.reduce((sum, p) => sum + p.videos, 0);
                const topProduct = settingsProductsData.sort((a, b) => b.gmv - a.gmv)[0];
                
                document.getElementById('settingsProductCount').textContent = totalProducts;
                document.getElementById('settingsProductGmv').textContent = '$' + totalGmv.toLocaleString(undefined, {maximumFractionDigits: 0});
                document.getElementById('settingsProductVideos').textContent = totalVideos.toLocaleString();
                
                const topProductEl = document.getElementById('settingsTopProduct');
                if (topProduct) {
                    const shortName = topProduct.name.length > 18 ? topProduct.name.substring(0, 18) + '...' : topProduct.name;
                    topProductEl.textContent = shortName;
                    topProductEl.title = topProduct.name;
                } else {
                    topProductEl.textContent = '-';
                    topProductEl.title = '';
                }
                
                // Default sort by GMV
                sortSettingsProducts('gmv');
                
            } catch (err) {
                console.error('Error loading settings products:', err);
                tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--error);">Error: ${err.message}</td></tr>`;
            }
        }
        
        function sortSettingsProducts(field) {
            if (settingsProductsSortField === field) {
                settingsProductsSortAsc = !settingsProductsSortAsc;
            } else {
                settingsProductsSortField = field;
                settingsProductsSortAsc = field === 'name'; // Name ascending by default, others descending
            }
            filterSettingsProducts();
        }
        
        function filterSettingsProducts() {
            const brandFilter = document.getElementById('settingsProductBrandFilter')?.value || 'all';
            const searchFilter = (document.getElementById('settingsProductSearch')?.value || '').toLowerCase();
            
            let filtered = settingsProductsData;
            
            if (brandFilter !== 'all') {
                filtered = filtered.filter(p => p.brand === brandFilter);
            }
            
            if (searchFilter) {
                filtered = filtered.filter(p => p.name.toLowerCase().includes(searchFilter));
            }
            
            // Sort
            const sortMult = settingsProductsSortAsc ? 1 : -1;
            filtered.sort((a, b) => {
                if (settingsProductsSortField === 'name') {
                    return sortMult * a.name.localeCompare(b.name);
                } else if (settingsProductsSortField === 'gmv') {
                    return sortMult * (a.gmv - b.gmv);
                } else if (settingsProductsSortField === 'videos') {
                    return sortMult * (a.videos - b.videos);
                } else if (settingsProductsSortField === 'orders') {
                    return sortMult * (a.orders - b.orders);
                }
                return 0;
            });
            
            document.getElementById('settingsProductFilterCount').textContent = `${filtered.length} product${filtered.length !== 1 ? 's' : ''}`;
            
            renderSettingsProductsTable(filtered);
        }
        
        function renderSettingsProductsTable(products) {
            const tbody = document.getElementById('settingsProductsTableBody');
            
            if (products.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 60px 40px; color: var(--text-muted);"><div style="font-size: 1.5rem; margin-bottom: 8px;">🔍</div>No products found matching filters</td></tr>';
                return;
            }
            
            tbody.innerHTML = products.map((p, index) => {
                const brandColor = {
                    'physicians_choice': '#22c55e',
                    'jiyu': '#8b5cf6', 
                    'catakor': '#f59e0b',
                    'peach_slices': '#ec4899',
                    'yerba_magic': '#14b8a6'
                }[p.brand] || 'var(--text-muted)';
                
                const brandDisplay = BRAND_DISPLAY[p.brand] || p.brand;
                const isTopPerformer = index < 3 && settingsProductsSortField === 'gmv' && !settingsProductsSortAsc;
                
                return `
                    <tr style="transition: background 0.15s;" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='transparent'">
                        <td style="padding: 14px 16px; max-width: 280px;">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                ${isTopPerformer ? `<span style="font-size: 0.9rem;">${index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}</span>` : `<span style="width: 20px; height: 20px; background: ${brandColor}20; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 0.7rem;">📦</span>`}
                                <span style="font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${sanitize(p.name)}">${sanitize(p.name)}</span>
                            </div>
                        </td>
                        <td style="padding: 14px 12px;">
                            <span style="background: ${brandColor}15; color: ${brandColor}; padding: 4px 10px; border-radius: 6px; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px;">
                                ${brandDisplay}
                            </span>
                        </td>
                        <td style="text-align: right; padding: 14px 16px; font-weight: 700; color: #22c55e; font-size: 0.95rem;">$${p.gmv.toLocaleString(undefined, {maximumFractionDigits: 0})}</td>
                        <td style="text-align: center; padding: 14px 12px; color: var(--text-secondary);">${p.videos.toLocaleString()}</td>
                        <td style="text-align: center; padding: 14px 12px; color: var(--text-secondary);">${p.orders.toLocaleString()}</td>
                        <td style="text-align: right; padding: 14px 16px; color: var(--text-muted); font-size: 0.85rem;">$${p.avgPerVideo.toLocaleString(undefined, {maximumFractionDigits: 0})}</td>
                    </tr>
                `;
            }).join('');
        }
        
        function toggleProductGroupsSection() {
            // Legacy function - no longer used
        }
        
        // ==================== PRODUCT GROUPS ====================
        let groupProductsData = []; // Products available for grouping
        let selectedGroupProducts = new Set(); // Currently selected product names
        
        function openCreateGroupModal() {
            document.getElementById('productGroupModalTitle').textContent = '📁 Create Product Group';
            document.getElementById('productGroupId').value = '';
            document.getElementById('productGroupName').value = '';
            document.getElementById('productGroupBrand').value = '';
            document.getElementById('groupProductSearch').value = '';
            document.getElementById('groupProductsContainer').innerHTML = '<div style="padding: 40px; text-align: center; color: var(--text-muted);">Select a brand to see available products</div>';
            selectedGroupProducts.clear();
            updateGroupSelectedCount();
            document.getElementById('productGroupModal').classList.add('show');
        }
        
        function closeProductGroupModal() {
            document.getElementById('productGroupModal').classList.remove('show');
        }
        
        async function loadProductsForGrouping() {
            const brand = document.getElementById('productGroupBrand').value;
            const container = document.getElementById('groupProductsContainer');
            
            if (!brand) {
                container.innerHTML = '<div style="padding: 40px; text-align: center; color: var(--text-muted);">Select a brand to see available products</div>';
                return;
            }
            
            container.innerHTML = '<div style="padding: 40px; text-align: center; color: var(--text-muted);"><div class="spinner" style="margin: 0 auto 12px;"></div>Loading products...</div>';
            
            try {
                // Get products from settingsProductsData (already loaded)
                groupProductsData = settingsProductsData.filter(p => p.brand === brand);
                
                if (groupProductsData.length === 0) {
                    // If not loaded yet, fetch from DB
                    const today = new Date();
                    const thirtyDaysAgo = new Date(today);
                    thirtyDaysAgo.setDate(today.getDate() - 30);
                    
                    const { data, error } = await supabaseClient
                        .from('video_performance')
                        .select('product_name, gmv, orders, video_id')
                        .eq('brand', brand)
                        .gte('report_date', localDateStr(thirtyDaysAgo))
                        .not('product_name', 'is', null);
                    
                    if (error) throw error;
                    
                    // Aggregate
                    const productMap = {};
                    (data || []).forEach(row => {
                        if (!row.product_name) return;
                        if (!productMap[row.product_name]) {
                            productMap[row.product_name] = { name: row.product_name, brand, gmv: 0, orders: 0, videoIds: new Set() };
                        }
                        productMap[row.product_name].gmv += row.gmv || 0;
                        productMap[row.product_name].orders += row.orders || 0;
                        if (row.video_id) productMap[row.product_name].videoIds.add(row.video_id);
                    });
                    
                    groupProductsData = Object.values(productMap).map(p => ({
                        ...p,
                        videos: p.videoIds.size
                    })).sort((a, b) => b.gmv - a.gmv);
                }
                
                renderGroupProductsList();
                
            } catch (err) {
                console.error('Error loading products for grouping:', err);
                container.innerHTML = '<div style="padding: 40px; text-align: center; color: var(--error);">Error loading products</div>';
            }
        }
        
        function renderGroupProductsList() {
            const container = document.getElementById('groupProductsContainer');
            const searchTerm = (document.getElementById('groupProductSearch')?.value || '').toLowerCase();
            
            let filtered = groupProductsData;
            if (searchTerm) {
                filtered = filtered.filter(p => p.name.toLowerCase().includes(searchTerm));
            }
            
            if (filtered.length === 0) {
                container.innerHTML = '<div style="padding: 40px; text-align: center; color: var(--text-muted);">No products found</div>';
                return;
            }
            
            container.innerHTML = filtered.map(p => {
                const isSelected = selectedGroupProducts.has(p.name);
                const escapedName = p.name.replace(/'/g, "\\'").replace(/"/g, '\\"');
                return `
                    <div onclick="toggleGroupProduct('${escapedName}')" 
                         style="display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--border); cursor: pointer; transition: background 0.15s; ${isSelected ? 'background: rgba(139, 92, 246, 0.15);' : ''}"
                         onmouseover="if(!${isSelected})this.style.background='var(--bg-card)'"
                         onmouseout="this.style.background='${isSelected ? 'rgba(139, 92, 246, 0.15)' : 'transparent'}'">
                        <div style="width: 24px; height: 24px; border: 2px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}; border-radius: 4px; display: flex; align-items: center; justify-content: center; background: ${isSelected ? 'var(--accent)' : 'transparent'}; flex-shrink: 0;">
                            ${isSelected ? '<span style="color: white; font-size: 0.8rem;">✓</span>' : ''}
                        </div>
                        <div style="flex: 1; min-width: 0;">
                            <div style="font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${sanitize(p.name)}">${sanitize(p.name)}</div>
                            <div style="font-size: 0.75rem; color: var(--text-muted);">${p.videos || 0} videos • ${p.orders || 0} orders</div>
                        </div>
                        <div style="text-align: right; flex-shrink: 0;">
                            <div style="font-weight: 600; color: #22c55e;">$${(p.gmv || 0).toLocaleString(undefined, {maximumFractionDigits: 0})}</div>
                        </div>
                    </div>
                `;
            }).join('');
        }
        
        function toggleGroupProduct(productName) {
            if (selectedGroupProducts.has(productName)) {
                selectedGroupProducts.delete(productName);
            } else {
                selectedGroupProducts.add(productName);
            }
            renderGroupProductsList();
            updateGroupSelectedCount();
        }
        
        function selectAllGroupProducts() {
            const searchTerm = (document.getElementById('groupProductSearch')?.value || '').toLowerCase();
            let filtered = groupProductsData;
            if (searchTerm) {
                filtered = filtered.filter(p => p.name.toLowerCase().includes(searchTerm));
            }
            filtered.forEach(p => selectedGroupProducts.add(p.name));
            renderGroupProductsList();
            updateGroupSelectedCount();
        }
        
        function deselectAllGroupProducts() {
            selectedGroupProducts.clear();
            renderGroupProductsList();
            updateGroupSelectedCount();
        }
        
        function filterGroupProducts() {
            renderGroupProductsList();
        }
        
        function updateGroupSelectedCount() {
            const count = selectedGroupProducts.size;
            const totalGmv = groupProductsData
                .filter(p => selectedGroupProducts.has(p.name))
                .reduce((sum, p) => sum + (p.gmv || 0), 0);
            
            document.getElementById('groupSelectedCount').textContent = `${count} product${count !== 1 ? 's' : ''} selected`;
            document.getElementById('groupSelectedGmv').textContent = `$${totalGmv.toLocaleString(undefined, {maximumFractionDigits: 0})} combined GMV`;
        }
        
        async function saveProductGroup() {
            const id = document.getElementById('productGroupId').value;
            const name = document.getElementById('productGroupName').value.trim();
            const brand = document.getElementById('productGroupBrand').value;
            
            if (!name || !brand) {
                showToast('Please enter a group name and select a brand', 'error');
                return;
            }
            
            if (selectedGroupProducts.size === 0) {
                showToast('Please select at least one product', 'error');
                return;
            }
            
            const productKey = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
            const productNames = Array.from(selectedGroupProducts);
            
            try {
                const groupData = {
                    product_key: productKey,
                    display_name: name,
                    brand: brand,
                    product_names: productNames,
                    status: 'active'
                };
                
                let result;
                if (id) {
                    result = await supabaseClient.from('product_groups').update(groupData).eq('id', id);
                } else {
                    result = await supabaseClient.from('product_groups').insert(groupData);
                }
                
                if (result.error) throw result.error;
                
                showToast(`Product group "${name}" saved!`, 'success');
                closeProductGroupModal();
                loadProductGroups();
                
            } catch (err) {
                console.error('Error saving product group:', err);
                if (err.message && err.message.includes('product_groups')) {
                    showToast('Product groups table not set up yet. Creating now...', 'warning');
                } else {
                    showToast('Error: ' + err.message, 'error');
                }
            }
        }
        
        async function loadProductGroups() {
            const container = document.getElementById('productGroupsList');
            const noGroupsMsg = document.getElementById('noGroupsMessage');
            
            if (!container || !noGroupsMsg) return;
            
            try {
                const { data, error } = await supabaseClient
                    .from('product_groups')
                    .select('*')
                    .order('display_name');
                
                if (error) throw error;
                
                if (!data || data.length === 0) {
                    container.innerHTML = '';
                    noGroupsMsg.style.display = 'block';
                    return;
                }
                
                noGroupsMsg.style.display = 'none';
                
                container.innerHTML = data.map(g => {
                    const productCount = (g.product_names || []).length;
                    const brandColor = {
                        'physicians_choice': '#22c55e',
                        'jiyu': '#8b5cf6', 
                        'catakor': '#f59e0b',
                        'peach_slices': '#ec4899',
                        'yerba_magic': '#14b8a6'
                    }[g.brand] || 'var(--text-muted)';
                    
                    return `
                        <div style="display: flex; align-items: center; gap: 16px; padding: 16px; background: var(--bg-secondary); border-radius: 8px; border: 1px solid var(--border);">
                            <div style="width: 48px; height: 48px; background: ${brandColor}20; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">📁</div>
                            <div style="flex: 1; min-width: 0;">
                                <div style="font-weight: 600; font-size: 1rem;">${sanitize(g.display_name)}</div>
                                <div style="font-size: 0.8rem; color: var(--text-muted);">${productCount} product${productCount !== 1 ? 's' : ''} • <span style="color: ${brandColor};">${BRAND_DISPLAY[g.brand] || g.brand}</span></div>
                            </div>
                            <div style="display: flex; gap: 8px;">
                                <button class="btn btn-sm" onclick="editProductGroup('${g.id}')" style="padding: 6px 12px;">✏️ Edit</button>
                                <button class="btn btn-sm" onclick="deleteProductGroup('${g.id}', '${sanitize(g.display_name).replace(/'/g, "\\'")}')" style="padding: 6px 12px; color: var(--error);">🗑️</button>
                            </div>
                        </div>
                    `;
                }).join('');
                
            } catch (err) {
                console.log('Product groups not available:', err.message);
                container.innerHTML = '';
                noGroupsMsg.style.display = 'block';
            }
        }
        
        async function editProductGroup(id) {
            try {
                const { data, error } = await supabaseClient
                    .from('product_groups')
                    .select('*')
                    .eq('id', id)
                    .single();
                
                if (error) throw error;
                
                document.getElementById('productGroupModalTitle').textContent = '✏️ Edit Product Group';
                document.getElementById('productGroupId').value = data.id;
                document.getElementById('productGroupName').value = data.display_name;
                document.getElementById('productGroupBrand').value = data.brand;
                
                selectedGroupProducts = new Set(data.product_names || []);
                
                await loadProductsForGrouping();
                updateGroupSelectedCount();
                
                document.getElementById('productGroupModal').classList.add('show');
                
            } catch (err) {
                console.error('Error loading product group:', err);
                showToast('Error loading group', 'error');
            }
        }
        
        async function deleteProductGroup(id, name) {
            if (!confirm(`Delete product group "${name}"?`)) return;
            
            try {
                const { error } = await supabaseClient.from('product_groups').delete().eq('id', id);
                if (error) throw error;
                
                showToast('Product group deleted', 'success');
                loadProductGroups();
                
            } catch (err) {
                console.error('Error deleting product group:', err);
                showToast('Error: ' + err.message, 'error');
            }
        }
        
        // ==================== END PRODUCTS MANAGER ====================
        
        // ==================== COMPENSATION SYSTEM ====================
        let brandProductsCache = {}; // Cache products by brand
        
        async function loadCompensation(brand, baseRetainer = 0, currentProductRetainers = {}) {
            const container = document.getElementById('productRetainersContainer');
            const totalRow = document.getElementById('compensationTotalRow');
            const baseInput = document.getElementById('creatorRetainer');
            const baseAffiliateBtn = document.getElementById('baseAffiliateBtn');
            
            if (!container) return;
            
            // Set base retainer
            if (baseInput) {
                baseInput.value = baseRetainer || '';
                if (baseRetainer === 0) {
                    baseAffiliateBtn.style.background = 'var(--blue)';
                    baseAffiliateBtn.style.color = 'white';
                    baseAffiliateBtn.style.borderColor = 'var(--blue)';
                    baseAffiliateBtn.textContent = '✓ Affiliate';
                    baseAffiliateBtn.dataset.active = 'true';
                    baseInput.disabled = true;
                    baseInput.style.opacity = '0.5';
                } else {
                    baseAffiliateBtn.style.background = '';
                    baseAffiliateBtn.style.color = '';
                    baseAffiliateBtn.style.borderColor = '';
                    baseAffiliateBtn.textContent = 'Affiliate';
                    baseAffiliateBtn.dataset.active = '';
                    baseInput.disabled = false;
                    baseInput.style.opacity = '1';
                }
            }
            
            // Load products for this brand
            try {
                if (!brandProductsCache[brand]) {
                    const { data, error } = await supabaseClient
                        .from('products')
                        .select('product_key, display_name')
                        .eq('brand', brand)
                        .eq('status', 'active')
                        .order('display_name');
                    
                    if (error) throw error;
                    brandProductsCache[brand] = data || [];
                }
                
                const products = brandProductsCache[brand];
                
                if (products.length === 0) {
                    container.innerHTML = '<div style="padding: 8px 12px; color: var(--text-muted); font-size: 0.85rem; text-align: center;">No product campaigns defined for this brand</div>';
                } else {
                    container.innerHTML = products.map(p => {
                        const retainerValue = currentProductRetainers[p.product_key];
                        const isAssigned = retainerValue !== undefined && retainerValue !== null;
                        const isAffiliate = retainerValue === 0;
                        const hasRetainer = retainerValue > 0;
                        
                        return `
                            <div style="display: flex; align-items: center; gap: 12px; padding: 10px 12px; background: ${isAssigned ? 'var(--bg-card)' : 'var(--bg-secondary)'}; border-radius: 8px; border: 1px solid ${isAssigned ? 'var(--accent)' : 'var(--border)'}; transition: all 0.2s;" data-product-row="${p.product_key}">
                                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; flex: 1;">
                                    <input type="checkbox" class="product-assignment-checkbox" value="${p.product_key}" ${isAssigned ? 'checked' : ''} onchange="toggleProductRow(this, '${p.product_key}')" style="width: 16px; height: 16px;">
                                    <div>
                                        <div style="font-size: 0.85rem; font-weight: 500;">${p.display_name}</div>
                                        <div style="font-size: 0.7rem; color: var(--text-muted);">Product campaign</div>
                                    </div>
                                </label>
                                <div class="product-controls" style="display: ${isAssigned ? 'flex' : 'none'}; align-items: center; gap: 8px;">
                                    <button type="button" class="btn btn-sm product-affiliate-btn" data-product="${p.product_key}" onclick="toggleProductAffiliate('${p.product_key}')" style="padding: 4px 10px; font-size: 0.75rem; ${isAffiliate ? 'background: var(--blue); color: white; border-color: var(--blue);' : ''}">
                                        ${isAffiliate ? '✓ Affiliate' : 'Affiliate'}
                                    </button>
                                    <div style="display: flex; align-items: center; gap: 4px;">
                                        <span style="color: var(--text-muted); font-size: 0.85rem;">$</span>
                                        <input type="number" class="product-retainer-input" data-product="${p.product_key}" value="${hasRetainer ? retainerValue : ''}" placeholder="0" style="width: 80px; padding: 6px 10px; border: 1px solid var(--border); border-radius: 4px; background: var(--bg-card); color: var(--text-primary); font-size: 0.85rem; text-align: right; ${isAffiliate ? 'opacity: 0.5;' : ''}" ${isAffiliate ? 'disabled' : ''} onchange="updateCompensationTotal()">
                                        <span style="color: var(--text-muted); font-size: 0.75rem;">/mo</span>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('');
                }
                
                updateCompensationTotal();
                
            } catch (err) {
                console.error('Error loading compensation:', err);
                container.innerHTML = '<div style="padding: 8px 12px; color: var(--danger); font-size: 0.85rem;">Error loading products</div>';
            }
        }
        
        function toggleBaseAffiliate() {
            const btn = document.getElementById('baseAffiliateBtn');
            const input = document.getElementById('creatorRetainer');
            const isActive = btn.dataset.active === 'true';
            
            if (isActive) {
                btn.dataset.active = '';
                btn.style.background = '';
                btn.style.color = '';
                btn.style.borderColor = '';
                btn.textContent = 'Affiliate';
                input.disabled = false;
                input.style.opacity = '1';
            } else {
                btn.dataset.active = 'true';
                btn.style.background = 'var(--blue)';
                btn.style.color = 'white';
                btn.style.borderColor = 'var(--blue)';
                btn.textContent = '✓ Affiliate';
                input.disabled = true;
                input.style.opacity = '0.5';
                input.value = '0';
            }
            updateCompensationTotal();
        }
        
        function toggleProductRow(checkbox, productKey) {
            const row = document.querySelector(`[data-product-row="${productKey}"]`);
            const controls = row.querySelector('.product-controls');
            const input = row.querySelector('.product-retainer-input');
            const affiliateBtn = row.querySelector('.product-affiliate-btn');
            
            if (checkbox.checked) {
                row.style.background = 'var(--bg-card)';
                row.style.borderColor = 'var(--accent)';
                controls.style.display = 'flex';
            } else {
                row.style.background = 'var(--bg-secondary)';
                row.style.borderColor = 'var(--border)';
                controls.style.display = 'none';
                input.value = '';
                affiliateBtn.dataset.active = '';
                affiliateBtn.style.background = '';
                affiliateBtn.style.color = '';
                affiliateBtn.style.borderColor = '';
                affiliateBtn.textContent = 'Affiliate';
                input.disabled = false;
                input.style.opacity = '1';
            }
            updateCompensationTotal();
        }
        
        function toggleProductAffiliate(productKey) {
            const row = document.querySelector(`[data-product-row="${productKey}"]`);
            const btn = row.querySelector('.product-affiliate-btn');
            const input = row.querySelector('.product-retainer-input');
            const isActive = btn.dataset.active === 'true';
            
            if (isActive) {
                btn.dataset.active = '';
                btn.style.background = '';
                btn.style.color = '';
                btn.style.borderColor = '';
                btn.textContent = 'Affiliate';
                input.disabled = false;
                input.style.opacity = '1';
            } else {
                btn.dataset.active = 'true';
                btn.style.background = 'var(--blue)';
                btn.style.color = 'white';
                btn.style.borderColor = 'var(--blue)';
                btn.textContent = '✓ Affiliate';
                input.disabled = true;
                input.style.opacity = '0.5';
                input.value = '';
            }
            updateCompensationTotal();
        }
        
        function updateCompensationTotal() {
            const baseInput = document.getElementById('creatorRetainer');
            const totalRow = document.getElementById('compensationTotalRow');
            const totalEl = document.getElementById('compensationTotal');
            
            let total = parseFloat(baseInput?.value) || 0;
            let hasProducts = false;
            
            document.querySelectorAll('.product-assignment-checkbox:checked').forEach(cb => {
                hasProducts = true;
                const row = document.querySelector(`[data-product-row="${cb.value}"]`);
                const input = row?.querySelector('.product-retainer-input');
                const value = parseFloat(input?.value) || 0;
                total += value;
            });
            
            // Show total row only if there's more than one retainer source
            const baseVal = parseFloat(baseInput?.value) || 0;
            const showTotal = (baseVal > 0 && hasProducts) || document.querySelectorAll('.product-retainer-input').length > 1;
            
            if (totalRow) {
                totalRow.style.display = (total > 0 && hasProducts) ? 'block' : 'none';
            }
            if (totalEl) {
                totalEl.textContent = fmtMoney(total) + '/mo';
            }
        }
        
        function getSelectedProductAssignments() {
            const checkboxes = document.querySelectorAll('.product-assignment-checkbox:checked');
            return Array.from(checkboxes).map(cb => cb.value);
        }
        
        function getProductRetainers() {
            const retainers = {};
            document.querySelectorAll('.product-assignment-checkbox:checked').forEach(cb => {
                const productKey = cb.value;
                const row = document.querySelector(`[data-product-row="${productKey}"]`);
                const affiliateBtn = row?.querySelector('.product-affiliate-btn');
                const input = row?.querySelector('.product-retainer-input');
                const isAffiliate = affiliateBtn?.dataset.active === 'true';
                const value = parseFloat(input?.value);
                
                if (isAffiliate) {
                    retainers[productKey] = 0;
                } else if (value > 0) {
                    retainers[productKey] = value;
                } else {
                    retainers[productKey] = null; // Assigned but not set
                }
            });
            return retainers;
        }
        
        // Update when brand changes in modal
        function onCreatorBrandChange() {
            const brand = document.getElementById('creatorBrand').value;
            const baseRetainer = parseFloat(document.getElementById('creatorRetainer')?.value) || 0;
            // When brand changes, reset product retainers but keep base retainer
            loadCompensation(brand, baseRetainer, {});
        }
        
        // ==================== END COMPENSATION SYSTEM ====================
        
        // ==================== PRODUCT-LEVEL GMV ====================
        // Cache for product definitions
        let productsDataCache = null;
        
        async function loadProductsCache() {
            if (productsDataCache) return productsDataCache;
            
            const { data, error } = await supabaseClient
                .from('products')
                .select('*')
                .eq('status', 'active');
            
            if (error) {
                console.error('Error loading products:', error);
                return [];
            }
            
            productsDataCache = data || [];
            return productsDataCache;
        }
        
        // Get product GMV for creators from video_performance table
        // Returns: { 'creator_name|brand': gmv }
        async function getProductGmv(productKey, startDate, endDate, brand) {
            const products = await loadProductsCache();
            const product = products.find(p => p.product_key === productKey);
            
            if (!product || !product.product_ids || product.product_ids.length === 0) {
                console.warn('Product not found or has no product IDs:', productKey);
                return {};
            }
            
            // Convert product_ids to strings for comparison (they might be stored as strings or numbers)
            const productIds = product.product_ids.map(id => String(id));
            
            // Fetch video_performance data for the date range and brand
            let query = supabaseClient
                .from('video_performance')
                .select('creator_name, brand, product_id, gmv')
                .gte('date', startDate)
                .lte('date', endDate);
            
            if (brand && brand !== 'all') {
                query = query.eq('brand', brand);
            }
            
            const { data, error } = await query;
            
            if (error) {
                console.error('Error fetching video_performance:', error);
                return {};
            }
            
            // Filter by product_ids and aggregate GMV by creator|brand
            const gmvMap = {};
            (data || []).forEach(row => {
                const rowProductId = String(row.product_id);
                if (productIds.includes(rowProductId)) {
                    const key = `${row.creator_name.toLowerCase()}|${row.brand}`;
                    if (!gmvMap[key]) gmvMap[key] = 0;
                    gmvMap[key] += pFloat(row.gmv);
                }
            });
            
            return gmvMap;
        }
        
        // Get creators filtered by product assignments
        function filterCreatorsByProduct(creators, productKey) {
            return creators.filter(c => {
                const productRetainers = c.product_retainers || {};
                // Creator is assigned if they have ANY entry for this product (including 0 or null)
                return productKey in productRetainers;
            });
        }
        
        // ==================== END PRODUCT-LEVEL GMV ====================
        
        // Weekly Detail Modal State
        let currentWeeklyDetailType = null;
        let weeklyDetailRawData = [];
        let weeklyDetailFilteredData = []; // Track current filtered data for export
        let weeklyDetailColumns = [];
        
        // Sort options per type
        const weeklyDetailSortOptions = {
            topPerformers: [
                { value: 'gmv-desc', label: 'GMV (High → Low)' },
                { value: 'gmv-asc', label: 'GMV (Low → High)' },
                { value: 'change-desc', label: 'Change % (Best)' },
                { value: 'change-asc', label: 'Change % (Worst)' },
                { value: 'retainer-desc', label: 'Retainer (High → Low)' },
                { value: 'name-asc', label: 'Name (A → Z)' }
            ],
            needsAttention: [
                { value: 'gmv-asc', label: 'GMV (Low → High)' },
                { value: 'gmv-desc', label: 'GMV (High → Low)' },
                { value: 'change-asc', label: 'Drop % (Worst)' },
                { value: 'retainer-desc', label: 'Retainer (High → Low)' },
                { value: 'name-asc', label: 'Name (A → Z)' }
            ],
            mostActive: [
                { value: 'count-desc', label: 'Videos (High → Low)' },
                { value: 'count-asc', label: 'Videos (Low → High)' },
                { value: 'gmv-desc', label: 'GMV (High → Low)' },
                { value: 'retainer-desc', label: 'Retainer (High → Low)' },
                { value: 'name-asc', label: 'Name (A → Z)' }
            ],
            belowTarget: [
                { value: 'count-asc', label: 'Videos (Low → High)' },
                { value: 'count-desc', label: 'Videos (High → Low)' },
                { value: 'priority-desc', label: 'Priority (Critical First)' },
                { value: 'retainer-desc', label: 'Retainer (High → Low)' },
                { value: 'name-asc', label: 'Name (A → Z)' }
            ]
        };
        
        function showWeeklyDetail(type) {
            console.log('showWeeklyDetail called with type:', type);
            currentWeeklyDetailType = type;
            const modal = document.getElementById('weeklyDetailModal');
            if (!modal) {
                console.error('Weekly detail modal not found');
                return;
            }
            
            const title = document.getElementById('weeklyDetailTitle');
            const summary = document.getElementById('weeklyDetailSummary');
            
            const d = weeklyReviewData;
            let titleText = '';
            let titleColor = '';
            let summaryHtml = '';
            
            try {
                // Get raw data and set up columns based on type
                switch (type) {
                    case 'topPerformers':
                        titleText = '🌟 Top Performers - Detailed View';
                        titleColor = 'var(--success)';
                        weeklyDetailRawData = (d.topPerformers || []).map(c => ({...c}));
                        weeklyDetailColumns = ['Creator', 'Brand', 'GMV', 'vs Prior', 'Orders', 'Retainer', 'ROI'];
                        const topTotalGmv = weeklyDetailRawData.reduce((s, c) => s + (c.gmv || 0), 0);
                        const topAvgGmv = weeklyDetailRawData.length > 0 ? topTotalGmv / weeklyDetailRawData.length : 0;
                        const topWithRetainer = weeklyDetailRawData.filter(c => c.retainer > 0).length;
                        summaryHtml = `
                            <div style="text-align: center;"><div style="font-weight: 700; font-size: 1.2rem; color: var(--success);">${weeklyDetailRawData.length}</div><div style="font-size: 0.75rem; color: var(--text-muted);">Top Creators</div></div>
                            <div style="text-align: center;"><div style="font-weight: 700; font-size: 1.2rem;">${fmtMoney(topTotalGmv)}</div><div style="font-size: 0.75rem; color: var(--text-muted);">Combined GMV</div></div>
                            <div style="text-align: center;"><div style="font-weight: 700; font-size: 1.2rem;">${fmtMoney(topAvgGmv)}</div><div style="font-size: 0.75rem; color: var(--text-muted);">Avg GMV</div></div>
                            <div style="text-align: center;"><div style="font-weight: 700; font-size: 1.2rem;">${topWithRetainer}</div><div style="font-size: 0.75rem; color: var(--text-muted);">With Retainer</div></div>
                        `;
                        break;
                        
                    case 'needsAttention':
                        titleText = '⚠️ Needs Attention - Detailed View';
                        titleColor = 'var(--error)';
                        weeklyDetailRawData = (d.needsAttention || []).map(c => ({...c}));
                        weeklyDetailColumns = ['Creator', 'Brand', 'GMV', 'vs Prior', 'Retainer', 'Issue'];
                        const totalRetainerAtRisk = weeklyDetailRawData.reduce((s, c) => s + (c.retainer || 0), 0);
                        const withRetainerCount = weeklyDetailRawData.filter(c => c.retainer > 0).length;
                        const droppedCount = weeklyDetailRawData.filter(c => (c.change || 0) < -50).length;
                        summaryHtml = `
                            <div style="text-align: center;"><div style="font-weight: 700; font-size: 1.2rem; color: var(--error);">${weeklyDetailRawData.length}</div><div style="font-size: 0.75rem; color: var(--text-muted);">Flagged Creators</div></div>
                            <div style="text-align: center;"><div style="font-weight: 700; font-size: 1.2rem;">${fmtMoney(totalRetainerAtRisk)}</div><div style="font-size: 0.75rem; color: var(--text-muted);">Retainer at Risk</div></div>
                            <div style="text-align: center;"><div style="font-weight: 700; font-size: 1.2rem;">${withRetainerCount}</div><div style="font-size: 0.75rem; color: var(--text-muted);">Low GMV + Retainer</div></div>
                            <div style="text-align: center;"><div style="font-weight: 700; font-size: 1.2rem;">${droppedCount}</div><div style="font-size: 0.75rem; color: var(--text-muted);">Dropped 50%+</div></div>
                        `;
                        break;
                        
                    case 'mostActive':
                        titleText = '🔥 Most Active - Detailed View';
                        titleColor = 'var(--blue)';
                        weeklyDetailRawData = (d.mostActive || []).map(c => ({...c}));
                        weeklyDetailColumns = ['Creator', 'Brand', 'Videos', 'GMV', 'Avg/Video', 'Retainer'];
                        const totalVideos = weeklyDetailRawData.reduce((s, c) => s + (c.count || 0), 0);
                        const avgVideos = weeklyDetailRawData.length > 0 ? totalVideos / weeklyDetailRawData.length : 0;
                        summaryHtml = `
                            <div style="text-align: center;"><div style="font-weight: 700; font-size: 1.2rem; color: var(--blue);">${weeklyDetailRawData.length}</div><div style="font-size: 0.75rem; color: var(--text-muted);">Active Creators</div></div>
                            <div style="text-align: center;"><div style="font-weight: 700; font-size: 1.2rem;">${totalVideos}</div><div style="font-size: 0.75rem; color: var(--text-muted);">Total Videos</div></div>
                            <div style="text-align: center;"><div style="font-weight: 700; font-size: 1.2rem;">${avgVideos.toFixed(1)}</div><div style="font-size: 0.75rem; color: var(--text-muted);">Avg Videos/Creator</div></div>
                            <div style="text-align: center;"><div style="font-weight: 700; font-size: 1.2rem;">5+</div><div style="font-size: 0.75rem; color: var(--text-muted);">Min Threshold</div></div>
                        `;
                        break;
                        
                    case 'belowTarget':
                        titleText = '😴 Below 5 Posts - Detailed View';
                        titleColor = 'var(--warning)';
                        weeklyDetailRawData = (d.belowTarget || []).map(c => ({...c}));
                        weeklyDetailColumns = ['Creator', 'Brand', 'Videos', 'Retainer', 'Gap', 'Priority'];
                        const zeroPosts = weeklyDetailRawData.filter(c => c.count === 0).length;
                        const oneToFour = weeklyDetailRawData.filter(c => c.count > 0 && c.count < 5).length;
                        const withRetainerBelowTarget = weeklyDetailRawData.filter(c => c.retainer > 0).length;
                        summaryHtml = `
                            <div style="text-align: center;"><div style="font-weight: 700; font-size: 1.2rem; color: var(--warning);">${weeklyDetailRawData.length}</div><div style="font-size: 0.75rem; color: var(--text-muted);">Below Target</div></div>
                            <div style="text-align: center;"><div style="font-weight: 700; font-size: 1.2rem; color: var(--error);">${zeroPosts}</div><div style="font-size: 0.75rem; color: var(--text-muted);">Zero Posts</div></div>
                            <div style="text-align: center;"><div style="font-weight: 700; font-size: 1.2rem;">${oneToFour}</div><div style="font-size: 0.75rem; color: var(--text-muted);">1-4 Posts</div></div>
                            <div style="text-align: center;"><div style="font-weight: 700; font-size: 1.2rem;">${withRetainerBelowTarget}</div><div style="font-size: 0.75rem; color: var(--text-muted);">With Retainer</div></div>
                        `;
                        break;
                }
                
                // Update modal header and summary
                title.innerHTML = `<span style="color: ${titleColor};">${titleText}</span>`;
                summary.innerHTML = summaryHtml;
                
                // Populate sort dropdown
                const sortSelect = document.getElementById('weeklyDetailSort');
                const sortOptions = weeklyDetailSortOptions[type] || [];
                sortSelect.innerHTML = sortOptions.map(opt => 
                    `<option value="${opt.value}">${opt.label}</option>`
                ).join('');
                
                // Reset filters
                document.getElementById('weeklyDetailSearch').value = '';
                document.getElementById('weeklyDetailBrand').value = 'all';
                document.getElementById('weeklyDetailRetainer').value = 'all';
                
                // Render table with current filters
                applyWeeklyDetailFilters();
                
                modal.classList.add('show');
            } catch (err) {
                console.error('Error in showWeeklyDetail:', err);
                modal.classList.add('show');
            }
        }
        
        function applyWeeklyDetailFilters() {
            const search = (document.getElementById('weeklyDetailSearch')?.value || '').toLowerCase();
            const brand = document.getElementById('weeklyDetailBrand')?.value || 'all';
            const retainer = document.getElementById('weeklyDetailRetainer')?.value || 'all';
            const sort = document.getElementById('weeklyDetailSort')?.value || '';
            
            // Filter data
            let filtered = weeklyDetailRawData.filter(c => {
                // Search filter
                const name = (c.name || c.handle || '').toLowerCase();
                const handle = (c.handle || c.name || '').toLowerCase();
                if (search && !name.includes(search) && !handle.includes(search)) return false;
                
                // Brand filter
                if (brand !== 'all' && c.brand !== brand) return false;
                
                // Retainer filter
                if (retainer === 'has' && !(c.retainer > 0)) return false;
                if (retainer === 'affiliate' && c.retainer !== 0) return false;
                if (retainer === 'none' && c.retainer !== null && c.retainer !== undefined) return false;
                
                return true;
            });
            
            // Sort data
            if (sort) {
                const [field, dir] = sort.split('-');
                const mult = dir === 'desc' ? -1 : 1;
                
                filtered.sort((a, b) => {
                    let aVal, bVal;
                    switch (field) {
                        case 'gmv': aVal = a.gmv || 0; bVal = b.gmv || 0; break;
                        case 'change': aVal = a.change || 0; bVal = b.change || 0; break;
                        case 'retainer': aVal = a.retainer || 0; bVal = b.retainer || 0; break;
                        case 'count': aVal = a.count || 0; bVal = b.count || 0; break;
                        case 'name': aVal = (a.name || '').toLowerCase(); bVal = (b.name || '').toLowerCase(); 
                            return mult * aVal.localeCompare(bVal);
                        case 'priority':
                            // Critical (0 posts) > High (retainer) > Affiliate ($0) > Medium
                            const getPriority = c => c.count === 0 ? 4 : (c.retainer > 0 ? 3 : (c.retainer === 0 ? 2 : 1));
                            aVal = getPriority(a); bVal = getPriority(b);
                            break;
                        default: return 0;
                    }
                    return mult * (bVal - aVal);
                });
            }
            
            // Update count display
            const countEl = document.getElementById('weeklyDetailCount');
            if (countEl) {
                countEl.textContent = `Showing ${filtered.length} of ${weeklyDetailRawData.length}`;
            }
            
            // Store filtered data for export
            weeklyDetailFilteredData = filtered;
            
            // Render table
            renderWeeklyDetailTable(filtered);
        }
        
        function renderWeeklyDetailTable(data) {
            const thead = document.getElementById('weeklyDetailHead');
            const tbody = document.getElementById('weeklyDetailBody');
            const type = currentWeeklyDetailType;
            const d = weeklyReviewData;
            
            // Build table header
            thead.innerHTML = `<tr>${weeklyDetailColumns.map((col, i) => 
                `<th style="${i > 1 ? 'text-align: right;' : ''}">${col}</th>`
            ).join('')}</tr>`;
            
            // Build table body
            if (data.length === 0) {
                tbody.innerHTML = `<tr><td colspan="${weeklyDetailColumns.length}" style="padding: 40px; text-align: center; color: var(--text-muted);">No matching creators</td></tr>`;
                return;
            }
            
            tbody.innerHTML = data.map((c, i) => {
                const change = c.change || 0;
                switch (type) {
                    case 'topPerformers':
                        const roi = c.retainer > 0 ? (c.gmv / c.retainer).toFixed(1) : '-';
                        return `<tr style="border-bottom: 1px solid var(--border);">
                            <td style="padding: 12px 16px;"><div style="font-weight: 600;">${i + 1}. @${c.name}</div></td>
                            <td style="padding: 12px 8px;"><span class="badge" style="font-size: 0.7rem;">${BRAND_DISPLAY[c.brand] || c.brand}</span></td>
                            <td style="padding: 12px 8px; text-align: right; font-weight: 700; color: var(--success);">${fmtMoney(c.gmv)}</td>
                            <td style="padding: 12px 8px; text-align: right; color: ${change >= 0 ? 'var(--success)' : 'var(--error)'};">${change >= 0 ? '+' : ''}${change.toFixed(0)}%</td>
                            <td style="padding: 12px 8px; text-align: right;">${c.orders || '-'}</td>
                            <td style="padding: 12px 8px; text-align: right;">${c.retainer > 0 ? fmtMoney(c.retainer) : (c.retainer === 0 ? '<span class="badge" style="background: var(--blue-dim); color: var(--blue); font-size: 0.65rem;">Affiliate</span>' : '-')}</td>
                            <td style="padding: 12px 8px; text-align: right; color: ${roi !== '-' && parseFloat(roi) >= 1 ? 'var(--success)' : 'var(--warning)'};">${roi !== '-' ? roi + 'x' : '-'}</td>
                        </tr>`;
                        
                    case 'needsAttention':
                        let issues = [];
                        if (c.retainer > 0 && c.gmv < 100) issues.push('Low GMV with retainer');
                        if (change < -50) issues.push(`Dropped ${Math.abs(change).toFixed(0)}%`);
                        return `<tr style="border-bottom: 1px solid var(--border); background: rgba(239, 68, 68, 0.05);">
                            <td style="padding: 12px 16px;"><div style="font-weight: 600;">@${c.name}</div></td>
                            <td style="padding: 12px 8px;"><span class="badge" style="font-size: 0.7rem;">${BRAND_DISPLAY[c.brand] || c.brand}</span></td>
                            <td style="padding: 12px 8px; text-align: right; font-weight: 700; color: var(--error);">${fmtMoney(c.gmv)}</td>
                            <td style="padding: 12px 8px; text-align: right; color: var(--error);">${change < 0 ? change.toFixed(0) + '%' : '-'}</td>
                            <td style="padding: 12px 8px; text-align: right;">${c.retainer > 0 ? fmtMoney(c.retainer) : (c.retainer === 0 ? '<span class="badge" style="background: var(--blue-dim); color: var(--blue); font-size: 0.65rem;">Affiliate</span>' : '-')}</td>
                            <td style="padding: 12px 8px; text-align: right;"><span style="font-size: 0.75rem; color: var(--error);">${issues.join(', ')}</span></td>
                        </tr>`;
                        
                    case 'mostActive':
                        const creatorGmv = (d.topPerformers || []).find(p => p.name.toLowerCase() === (c.handle || c.name).toLowerCase())?.gmv || 0;
                        const avgPerVideo = c.count > 0 ? creatorGmv / c.count : 0;
                        return `<tr style="border-bottom: 1px solid var(--border);">
                            <td style="padding: 12px 16px;"><div style="font-weight: 600;">${i + 1}. ${c.name}</div><div style="font-size: 0.75rem; color: var(--text-muted);">@${c.handle || c.name}</div></td>
                            <td style="padding: 12px 8px;"><span class="badge" style="font-size: 0.7rem;">${BRAND_DISPLAY[c.brand] || c.brand}</span></td>
                            <td style="padding: 12px 8px; text-align: right; font-weight: 700; color: var(--blue);">${c.count} videos</td>
                            <td style="padding: 12px 8px; text-align: right;">${creatorGmv > 0 ? fmtMoney(creatorGmv) : '-'}</td>
                            <td style="padding: 12px 8px; text-align: right;">${avgPerVideo > 0 ? fmtMoney(avgPerVideo) : '-'}</td>
                            <td style="padding: 12px 8px; text-align: right;">${c.retainer > 0 ? fmtMoney(c.retainer) : (c.retainer === 0 ? '<span class="badge" style="background: var(--blue-dim); color: var(--blue); font-size: 0.65rem;">Affiliate</span>' : '-')}</td>
                        </tr>`;
                        
                    case 'belowTarget':
                        const gap = 5 - c.count;
                        const priority = c.count === 0 ? '🔴 Critical' : (c.retainer > 0 ? '🟠 High' : (c.retainer === 0 ? '🔵 Affiliate' : '🟡 Medium'));
                        return `<tr style="border-bottom: 1px solid var(--border); background: ${c.count === 0 ? 'rgba(239, 68, 68, 0.05)' : 'transparent'};">
                            <td style="padding: 12px 16px;"><div style="font-weight: 600;">${c.name}</div><div style="font-size: 0.75rem; color: var(--text-muted);">@${c.handle || c.name}</div></td>
                            <td style="padding: 12px 8px;"><span class="badge" style="font-size: 0.7rem;">${BRAND_DISPLAY[c.brand] || c.brand}</span></td>
                            <td style="padding: 12px 8px; text-align: right; font-weight: 700; color: ${c.count === 0 ? 'var(--error)' : 'var(--warning)'};">${c.count} videos</td>
                            <td style="padding: 12px 8px; text-align: right;">${c.retainer > 0 ? fmtMoney(c.retainer) : (c.retainer === 0 ? '<span class="badge" style="background: var(--blue-dim); color: var(--blue); font-size: 0.65rem;">Affiliate</span>' : '-')}</td>
                            <td style="padding: 12px 8px; text-align: right;">-${gap} videos</td>
                            <td style="padding: 12px 8px; text-align: right;">${priority}</td>
                        </tr>`;
                }
            }).join('');
        }
        
        function closeWeeklyDetailModal() {
            document.getElementById('weeklyDetailModal').classList.remove('show');
            currentWeeklyDetailType = null;
        }
        
        function exportWeeklyDetail() {
            const type = currentWeeklyDetailType;
            const sourceData = weeklyDetailFilteredData;
            let data = [];
            let headers = [];
            let filename = '';
            
            switch (type) {
                case 'topPerformers':
                    headers = ['Rank', 'Creator', 'Brand', 'GMV', 'Change %', 'Orders', 'Retainer'];
                    data = sourceData.map((c, i) => [
                        i + 1, `@${c.name}`, c.brand, (c.gmv || 0).toFixed(2), (c.change || 0).toFixed(1), c.orders || 0, c.retainer || 0
                    ]);
                    filename = 'top-performers';
                    break;
                case 'needsAttention':
                    headers = ['Creator', 'Brand', 'GMV', 'Change %', 'Retainer', 'Issue'];
                    data = sourceData.map(c => {
                        let issues = [];
                        if (c.retainer > 0 && c.gmv < 100) issues.push('Low GMV');
                        if ((c.change || 0) < -50) issues.push('Big drop');
                        return [`@${c.name}`, c.brand, (c.gmv || 0).toFixed(2), (c.change || 0).toFixed(1), c.retainer || 0, issues.join('; ')];
                    });
                    filename = 'needs-attention';
                    break;
                case 'mostActive':
                    headers = ['Rank', 'Creator', 'Handle', 'Brand', 'Videos', 'Retainer'];
                    data = sourceData.map((c, i) => [
                        i + 1, c.name, `@${c.handle || c.name}`, c.brand, c.count, c.retainer || 0
                    ]);
                    filename = 'most-active';
                    break;
                case 'belowTarget':
                    headers = ['Creator', 'Handle', 'Brand', 'Videos', 'Gap', 'Retainer', 'Priority'];
                    data = sourceData.map(c => {
                        const gap = 5 - c.count;
                        const priority = c.count === 0 ? 'Critical' : (c.retainer > 0 ? 'High' : (c.retainer === 0 ? 'Affiliate' : 'Medium'));
                        return [c.name, `@${c.handle || c.name}`, c.brand, c.count, gap, c.retainer || 0, priority];
                    });
                    filename = 'below-target';
                    break;
            }
            
            const csv = [headers, ...data].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
            downloadCSV(csv, `weekly-review-${filename}-${new Date().toISOString().split('T')[0]}.csv`);
            showToast(`Exported ${data.length} rows!`, 'success');
        }
        
        function copyWeeklyDetailForDiscord() {
            const sourceData = weeklyDetailFilteredData;
            const type = currentWeeklyDetailType;
            const filterBrand = document.getElementById('weeklyDetailBrand')?.value || 'all';
            const brandName = filterBrand === 'all' ? 'All Brands' : (BRAND_DISPLAY[filterBrand] || filterBrand);
            
            let text = '';
            
            switch (type) {
                case 'topPerformers':
                    text = `🌟 **TOP PERFORMERS - ${brandName}** (${sourceData.length})\n\n`;
                    sourceData.forEach((c, i) => {
                        text += `${i + 1}. @${c.name} - ${fmtMoney(c.gmv)}`;
                        if ((c.change || 0) > 0) text += ` (+${c.change.toFixed(0)}%)`;
                        if (c.retainer > 0) text += ` 💵`;
                        else if (c.retainer === 0) text += ` 🔵`;
                        text += `\n`;
                    });
                    break;
                    
                case 'needsAttention':
                    text = `⚠️ **NEEDS ATTENTION - ${brandName}** (${sourceData.length})\n\n`;
                    sourceData.forEach(c => {
                        text += `• @${c.name} - ${fmtMoney(c.gmv)}`;
                        if (c.retainer > 0) text += ` (${fmtMoney(c.retainer)} retainer)`;
                        else if (c.retainer === 0) text += ` (Affiliate)`;
                        if ((c.change || 0) < -50) text += ` ⬇️${Math.abs(c.change).toFixed(0)}%`;
                        text += `\n`;
                    });
                    break;
                    
                case 'mostActive':
                    text = `🔥 **MOST ACTIVE - ${brandName}** (${sourceData.length})\n\n`;
                    sourceData.forEach((c, i) => {
                        text += `${i + 1}. ${c.name} - ${c.count} videos`;
                        if (c.retainer > 0) text += ` 💵`;
                        else if (c.retainer === 0) text += ` 🔵`;
                        text += `\n`;
                    });
                    break;
                    
                case 'belowTarget':
                    text = `😴 **BELOW 5 POSTS - ${brandName}** (${sourceData.length})\n\n`;
                    const zero = sourceData.filter(c => c.count === 0);
                    const low = sourceData.filter(c => c.count > 0 && c.count < 5);
                    
                    if (zero.length > 0) {
                        text += `**🔴 Zero posts:**\n`;
                        zero.forEach(c => {
                            text += `• ${c.name}`;
                            if (c.retainer > 0) text += ` (${fmtMoney(c.retainer)} retainer!)`;
                            else if (c.retainer === 0) text += ` (Affiliate)`;
                            text += `\n`;
                        });
                        text += `\n`;
                    }
                    if (low.length > 0) {
                        text += `**🟠 1-4 posts:**\n`;
                        low.forEach(c => {
                            text += `• ${c.name} (${c.count} posts)`;
                            if (c.retainer > 0) text += ` 💵`;
                            else if (c.retainer === 0) text += ` 🔵`;
                            text += `\n`;
                        });
                    }
                    break;
            }
            
            navigator.clipboard.writeText(text).then(() => {
                showToast('Copied to clipboard!', 'success');
            }).catch(() => {
                showToast('Failed to copy', 'error');
            });
        }

