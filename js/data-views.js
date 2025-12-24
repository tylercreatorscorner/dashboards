// ==================== DATA VIEWS ====================
        // ==================== CREATORS ====================
        let creatorsCache = { current: [], prior: [], filtered: [] };
        
        async function loadCreatorsData() {
            showLoading('creators', 'Loading creator data...');
            window.creatorsDataLoaded = true; // Mark that Creators view has been loaded
            try {
            const brand = document.getElementById('creatorsBrandFilter').value;
            const startDate = document.getElementById('creatorsDateFilterStart').value;
            const endDate = document.getElementById('creatorsDateFilterEnd').value;
            const status = document.getElementById('creatorsStatusFilter').value;
            const tier = document.getElementById('creatorsTierFilter').value;
            const search = document.getElementById('creatorsSearchInput').value.toLowerCase();

            if (!startDate || !endDate) { hideLoading('creators'); return; }

            // Calculate prior period
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
                let query = supabaseClient.from('creator_performance')
                    .select('*')
                    .gte('report_date', startDate)
                    .lte('report_date', endDate)
                    .eq('period_type', 'daily')
                    .range(page * pageSize, (page + 1) * pageSize - 1);
                
                if (brand !== 'all') query = query.eq('brand', brand);
                
                const { data, error } = await query;
                
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
                let query = supabaseClient.from('creator_performance')
                    .select('*')
                    .gte('report_date', localDateStr(priorStart))
                    .lte('report_date', localDateStr(priorEnd))
                    .eq('period_type', 'daily')
                    .range(page * pageSize, (page + 1) * pageSize - 1);
                
                if (brand !== 'all') query = query.eq('brand', brand);
                
                const { data, error } = await query;
                
                if (error || !data || data.length === 0) {
                    hasMore = false;
                } else {
                    priorData = priorData.concat(data);
                    hasMore = data.length === pageSize;
                    page++;
                }
                if (page >= MAX_PAGES) break;
            }

            // Aggregate current period by creator
            const creatorMap = new Map();
            allData.forEach(row => {
                const key = `${row.creator_name}|||${row.brand}`;
                if (!creatorMap.has(key)) {
                    creatorMap.set(key, {
                        creator_name: row.creator_name,
                        brand: row.brand,
                        gmv: 0, orders: 0, videos: 0, est_commission: 0
                    });
                }
                const c = creatorMap.get(key);
                c.gmv += pFloat(row.gmv);
                c.orders += pInt(row.orders);
                c.videos += pInt(row.videos);
                c.est_commission += pFloat(row.est_commission);
            });

            // Aggregate prior period by creator
            const priorMap = new Map();
            priorData.forEach(row => {
                const key = `${row.creator_name}|||${row.brand}`;
                if (!priorMap.has(key)) {
                    priorMap.set(key, { gmv: 0 });
                }
                priorMap.get(key).gmv += pFloat(row.gmv);
            });

            // Build creators array with WoW change
            let creators = [...creatorMap.values()].map(c => {
                const priorGmv = priorMap.get(`${c.creator_name}|||${c.brand}`)?.gmv || 0;
                const change = priorGmv > 0 ? ((c.gmv - priorGmv) / priorGmv * 100) : (c.gmv > 0 ? 100 : 0);
                const isNew = priorGmv === 0 && c.gmv > 0;
                return {
                    ...c,
                    aov: c.orders > 0 ? c.gmv / c.orders : 0,
                    priorGmv,
                    change,
                    isNew,
                    managed: isManagedForBrand(c.creator_name, c.brand)
                };
            });

            // Apply status filter
            if (status === 'managed') {
                creators = creators.filter(c => c.managed);
            } else if (status === 'unmanaged') {
                creators = creators.filter(c => !c.managed);
            }

            // Apply tier filter
            if (tier !== 'all') {
                const tierObj = TIERS.find(t => t.name.toLowerCase() === tier);
                const tierIdx = TIERS.indexOf(tierObj);
                const maxGmv = tierIdx > 0 ? TIERS[tierIdx - 1].min : Infinity;
                creators = creators.filter(c => c.gmv >= tierObj.min && c.gmv < maxGmv);
            }

            // Apply search filter
            if (search) {
                creators = creators.filter(c => c.creator_name.toLowerCase().includes(search));
            }

            // Sort by GMV descending
            creators.sort((a, b) => b.gmv - a.gmv);
            
            // Cache for export and other uses
            creatorsCache.filtered = creators;

            // Calculate current stats
            const totalGmv = creators.reduce((s, c) => s + c.gmv, 0);
            const priorTotalGmv = creators.reduce((s, c) => s + c.priorGmv, 0);
            const totalCommission = creators.reduce((s, c) => s + c.est_commission, 0);
            const managedCount = creators.filter(c => c.managed).length;
            const unmanagedCount = creators.filter(c => !c.managed).length;
            const risingCount = creators.filter(c => !c.isNew && c.change >= 20).length;
            const decliningCount = creators.filter(c => c.change <= -20).length;
            const avgGmv = creators.length ? totalGmv / creators.length : 0;
            
            // Calculate prior period stats for trend comparison
            const priorCreatorMap = new Map();
            let filteredPriorData = priorData;
            if (status === 'managed') {
                filteredPriorData = priorData.filter(d => isManagedForBrand(d.creator_name, d.brand));
            } else if (status === 'unmanaged') {
                filteredPriorData = priorData.filter(d => !isManagedForBrand(d.creator_name, d.brand));
            }
            filteredPriorData.forEach(row => {
                const key = `${row.creator_name}|||${row.brand}`;
                if (!priorCreatorMap.has(key)) {
                    priorCreatorMap.set(key, { gmv: 0, commission: 0 });
                }
                const c = priorCreatorMap.get(key);
                c.gmv += pFloat(row.gmv);
                c.commission += pFloat(row.est_commission);
            });
            const priorCreatorCount = priorCreatorMap.size;
            const priorCommission = [...priorCreatorMap.values()].reduce((s, c) => s + c.commission, 0);
            const priorAvgGmv = priorCreatorCount > 0 ? priorTotalGmv / priorCreatorCount : 0;

            // Update stats display with trend indicators
            document.getElementById('creatorsStatGmv').textContent = fmtMoney(totalGmv);
            updateTrendIndicator('creatorsStatGmvChange', totalGmv, priorTotalGmv);
            
            document.getElementById('creatorsStatTotal').textContent = creators.length;
            updateTrendIndicator('creatorsStatTotalChange', creators.length, priorCreatorCount);
            
            document.getElementById('creatorsStatAvg').textContent = fmtMoney(avgGmv);
            updateTrendIndicator('creatorsStatAvgChange', avgGmv, priorAvgGmv);
            
            document.getElementById('creatorsStatCommission').textContent = fmtMoney(totalCommission);
            updateTrendIndicator('creatorsStatCommissionChange', totalCommission, priorCommission);
            
            document.getElementById('creatorsStatRising').textContent = risingCount;
            document.getElementById('creatorsStatDeclining').textContent = decliningCount;

            // Render insight cards
            renderCreatorInsights(creators);

            // Update table count
            document.getElementById('creatorsTableCount').textContent = `${creators.length} creators`;

            // Paginate and render table
            const startIdx = (pages.creators - 1) * PAGE_SIZE;
            const pageData = creators.slice(startIdx, startIdx + PAGE_SIZE);

            document.getElementById('creatorsFullBody').innerHTML = pageData.map(c => {
                const tierInfo = getTier(c.gmv);
                const changeClass = c.isNew ? 'trend-neutral' : c.change >= 0 ? 'trend-up' : 'trend-down';
                const changeText = c.isNew ? '🆕 New' : `${c.change >= 0 ? '↑' : '↓'} ${Math.abs(c.change).toFixed(0)}%`;
                
                return `<tr class="clickable" onclick="openCreatorDetail('${c.creator_name.replace(/'/g, "\\'")}', '${c.brand}')">
                    <td onclick="event.stopPropagation()"><input type="checkbox" class="creator-checkbox" data-creator="${c.creator_name}" data-brand="${c.brand}" onchange="updateBulkSelection()"></td>
                    <td><div class="creator-cell">
                        <div class="creator-avatar">${c.creator_name.charAt(0).toUpperCase()}</div>
                        <span class="creator-name">${c.creator_name}</span>
                    </div></td>
                    <td><span class="badge-brand">${BRAND_DISPLAY[c.brand] || c.brand}</span></td>
                    <td><span class="badge ${c.managed ? 'badge-managed' : 'badge-unmanaged'}">${c.managed ? '✓ Managed' : 'Unmanaged'}</span></td>
                    <td><span class="gmv-value gmv-high">${fmtMoney(c.gmv)}</span></td>
                    <td><span class="trend-indicator ${changeClass}">${changeText}</span></td>
                    <td>${fmt(c.orders)}</td>
                    <td>${fmtMoney(c.aov)}</td>
                    <td>${c.videos}</td>
                    <td>${fmtMoney(c.est_commission)}</td>
                    <td><span class="badge-tier ${tierInfo.class}">${tierInfo.name}</span></td>
                    <td onclick="event.stopPropagation()">
                        ${c.managed 
                            ? '<span style="color: var(--text-muted); font-size: 0.8rem;">In Roster</span>'
                            : `<button class="btn btn-primary" style="padding: 4px 10px; font-size: 0.75rem;" onclick="quickAddToRoster('${c.creator_name.replace(/'/g, "\\'")}', '${c.brand}')">➕ Add</button>`
                        }
                    </td>
                </tr>`;
            }).join('') || '<tr><td colspan="12"><div class="empty-state"><h3>No creators found</h3><p>Try adjusting your filters</p></div></td></tr>';

            // Clear selection when data reloads
            document.getElementById('selectAllCreators').checked = false;
            updateBulkSelection();
            
            // Check data validation status for current filters
            updateCreatorsValidationBanner(brand, startDate, endDate);
            
            renderPagination('creatorsPagination', creators.length, pages.creators, (p) => { pages.creators = p; loadCreatorsData(); });
            } finally {
                hideLoading('creators');
            }
        }

        async function updateCreatorsValidationBanner(brand, startDate, endDate) {
            const banner = document.getElementById('creatorsValidationBanner');
            const icon = document.getElementById('creatorsValidationIcon');
            const text = document.getElementById('creatorsValidationText');
            
            if (!banner) return;
            
            try {
                // Get affiliate data for the date range
                let affQuery = supabaseClient
                    .from('affiliate_summary')
                    .select('gmv, report_date, brand')
                    .gte('report_date', startDate)
                    .lte('report_date', endDate);
                if (brand !== 'all') affQuery = affQuery.eq('brand', brand);
                
                const { data: affData, error: affError } = await affQuery;
                
                if (affError || !affData || affData.length === 0) {
                    // No affiliate data - hide banner
                    banner.style.display = 'none';
                    return;
                }
                
                // Sum affiliate totals
                const affTotal = affData.reduce((sum, r) => sum + pFloat(r.gmv), 0);
                const daysWithAffData = affData.length;
                
                // Get creator performance totals for the same range with proper pagination
                let allCpData = [];
                let page = 0;
                let hasMore = true;
                
                while (hasMore && page < MAX_PAGES) {
                    // Create fresh query for each page
                    let query = supabaseClient
                        .from('creator_performance')
                        .select('gmv')
                        .gte('report_date', startDate)
                        .lte('report_date', endDate)
                        .eq('period_type', 'daily')
                        .range(page * QUERY_PAGE_SIZE, (page + 1) * QUERY_PAGE_SIZE - 1);
                    
                    if (brand !== 'all') query = query.eq('brand', brand);
                    
                    const { data: pageData, error } = await query;
                    
                    if (error || !pageData || pageData.length === 0) {
                        hasMore = false;
                    } else {
                        allCpData = allCpData.concat(pageData);
                        hasMore = pageData.length === QUERY_PAGE_SIZE;
                        page++;
                    }
                }
                
                const cpTotal = allCpData.reduce((sum, r) => sum + pFloat(r.gmv), 0);
                
                // Calculate variance
                const variance = cpTotal - affTotal;
                const variancePct = affTotal > 0 ? (variance / affTotal) * 100 : 0;
                
                // Update banner
                banner.style.display = 'flex';
                
                if (Math.abs(variancePct) <= 1) {
                    // Match
                    banner.style.background = 'linear-gradient(135deg, rgba(34, 197, 94, 0.1), transparent)';
                    banner.style.border = '1px solid rgba(34, 197, 94, 0.3)';
                    icon.textContent = '✅';
                    text.innerHTML = `<strong>Data Validated</strong> &nbsp;|&nbsp; ${daysWithAffData} day${daysWithAffData > 1 ? 's' : ''}: ${formatCurrency(affTotal)} affiliate ≈ ${formatCurrency(cpTotal)} creator`;
                } else if (Math.abs(variancePct) <= 5) {
                    // Minor variance
                    banner.style.background = 'linear-gradient(135deg, rgba(245, 197, 24, 0.1), transparent)';
                    banner.style.border = '1px solid rgba(245, 197, 24, 0.3)';
                    icon.textContent = '⚠️';
                    text.innerHTML = `<strong>Minor Variance</strong> &nbsp;|&nbsp; ${formatCurrency(Math.abs(variance))} (${variancePct.toFixed(1)}%) ${variance > 0 ? 'over' : 'under'} affiliate total`;
                } else {
                    // Significant variance
                    banner.style.background = 'linear-gradient(135deg, rgba(239, 68, 68, 0.1), transparent)';
                    banner.style.border = '1px solid rgba(239, 68, 68, 0.3)';
                    icon.textContent = '❌';
                    text.innerHTML = `<strong>Data Variance</strong> &nbsp;|&nbsp; ${formatCurrency(Math.abs(variance))} (${variancePct.toFixed(1)}%) ${variance > 0 ? 'over' : 'under'} affiliate total`;
                }
                
            } catch (err) {
                console.warn('Validation banner error:', err);
                banner.style.display = 'none';
            }
        }

        function renderCreatorInsights(creators) {
            // Top Performers - top 5 by GMV
            const topPerformers = creators.slice(0, 5);
            document.getElementById('creatorsTopPerformers').innerHTML = topPerformers.length ? topPerformers.map((c, i) => `
                <div class="leaderboard-item" onclick="openCreatorDetail('${c.creator_name.replace(/'/g, "\\'")}', '${c.brand}')" style="cursor: pointer;">
                    <div class="leaderboard-rank">${i + 1}</div>
                    <div class="leaderboard-info">
                        <div class="leaderboard-name">${c.creator_name}</div>
                        <div class="leaderboard-brand">${BRAND_DISPLAY[c.brand] || c.brand}</div>
                    </div>
                    <div class="leaderboard-value">${fmtMoney(c.gmv)}</div>
                </div>
            `).join('') : '<div class="empty-state" style="padding: 20px;"><p>No data</p></div>';

            // Rising Stars - top 5 by % increase (exclude new creators, require min $500 GMV)
            const risingStars = creators
                .filter(c => !c.isNew && c.change > 0 && c.gmv >= 500)
                .sort((a, b) => b.change - a.change)
                .slice(0, 5);
            document.getElementById('creatorsRisingStars').innerHTML = risingStars.length ? risingStars.map(c => `
                <div class="leaderboard-item" onclick="openCreatorDetail('${c.creator_name.replace(/'/g, "\\'")}', '${c.brand}')" style="cursor: pointer;">
                    <div class="leaderboard-info">
                        <div class="leaderboard-name">${c.creator_name}</div>
                        <div class="leaderboard-brand">${BRAND_DISPLAY[c.brand] || c.brand}</div>
                    </div>
                    <div class="trend-indicator trend-up">↑ ${c.change.toFixed(0)}%</div>
                </div>
            `).join('') : '<div class="empty-state" style="padding: 20px;"><p>No rising stars this period</p></div>';

            // Needs Attention - biggest decliners (exclude those who were already at $0)
            const needsAttention = creators
                .filter(c => c.change < 0 && c.priorGmv >= 500)
                .sort((a, b) => a.change - b.change)
                .slice(0, 5);
            document.getElementById('creatorsNeedsAttention').innerHTML = needsAttention.length ? needsAttention.map(c => `
                <div class="leaderboard-item" onclick="openCreatorDetail('${c.creator_name.replace(/'/g, "\\'")}', '${c.brand}')" style="cursor: pointer;">
                    <div class="leaderboard-info">
                        <div class="leaderboard-name">${c.creator_name}</div>
                        <div class="leaderboard-brand">${BRAND_DISPLAY[c.brand] || c.brand}</div>
                    </div>
                    <div class="trend-indicator trend-down">↓ ${Math.abs(c.change).toFixed(0)}%</div>
                </div>
            `).join('') : '<div class="empty-state" style="padding: 20px;"><p>No declining creators 🎉</p></div>';

            // Recruit Opportunities - top unmanaged by GMV (min $1000)
            const recruitOpportunities = creators
                .filter(c => !c.managed && c.gmv >= 1000)
                .sort((a, b) => b.gmv - a.gmv)
                .slice(0, 5);
            document.getElementById('creatorsRecruitOpportunities').innerHTML = recruitOpportunities.length ? recruitOpportunities.map(c => `
                <div class="leaderboard-item" style="cursor: pointer;">
                    <div class="leaderboard-info" onclick="openCreatorDetail('${c.creator_name.replace(/'/g, "\\'")}', '${c.brand}')">
                        <div class="leaderboard-name">${c.creator_name}</div>
                        <div class="leaderboard-brand">${BRAND_DISPLAY[c.brand] || c.brand}</div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span class="gmv-value" style="font-size: 0.85rem;">${fmtMoney(c.gmv)}</span>
                        <button class="btn btn-sm" onclick="event.stopPropagation(); quickAddToRoster('${c.creator_name.replace(/'/g, "\\'")}', '${c.brand}')" style="padding: 4px 8px; font-size: 0.75rem; background: var(--accent); border: none; border-radius: 4px;">+</button>
                    </div>
                </div>
            `).join('') : '<div class="empty-state" style="padding: 20px;"><p>No unmanaged high-performers</p></div>';
        }

        // Bulk selection functions
        let selectedCreators = [];

        function toggleSelectAll(checkbox) {
            const checkboxes = document.querySelectorAll('.creator-checkbox');
            checkboxes.forEach(cb => cb.checked = checkbox.checked);
            updateBulkSelection();
        }

        function updateBulkSelection() {
            const checkboxes = document.querySelectorAll('.creator-checkbox:checked');
            selectedCreators = Array.from(checkboxes).map(cb => ({
                creator_name: cb.dataset.creator,
                brand: cb.dataset.brand
            }));
            
            const bar = document.getElementById('bulkActionsBar');
            const count = document.getElementById('selectedCount');
            
            if (selectedCreators.length > 0) {
                bar.style.display = 'flex';
                count.textContent = `${selectedCreators.length} selected`;
            } else {
                bar.style.display = 'none';
            }
        }

        function clearSelection() {
            document.querySelectorAll('.creator-checkbox').forEach(cb => cb.checked = false);
            document.getElementById('selectAllCreators').checked = false;
            updateBulkSelection();
        }

        // Store bulk add data
        let bulkAddCreators = [];
        
        async function bulkAddToRoster() {
            if (selectedCreators.length === 0) return;
            
            const unmanaged = selectedCreators.filter(c => !isManagedForBrand(c.creator_name, c.brand));
            if (unmanaged.length === 0) {
                showToast('All selected creators are already in roster for their brands', 'info');
                return;
            }
            
            // Open enhanced modal instead of direct insert
            openBulkAddModal(unmanaged);
        }
        
        function openBulkAddModal(creators) {
            bulkAddCreators = creators.map(c => ({
                ...c,
                selected: true,
                discord: '',
                role: 'Incubator',
                status: 'Active',
                suggestedRole: suggestRoleByGmv(c.gmv),
                crossBrandMatch: findCrossBrandMatch(c.creator_name)
            }));
            
            // Check for cross-brand matches
            const crossBrandMatches = bulkAddCreators.filter(c => c.crossBrandMatch);
            if (crossBrandMatches.length > 0) {
                document.getElementById('crossBrandHint').style.display = 'block';
                document.getElementById('crossBrandMessage').textContent = 
                    `${crossBrandMatches.length} creator(s) found in other brands. Click "Match" to auto-fill info.`;
            } else {
                document.getElementById('crossBrandHint').style.display = 'none';
            }
            
            // Apply auto-suggest if enabled
            if (document.getElementById('bulkAutoSuggestRole').checked) {
                bulkAddCreators.forEach(c => c.role = c.suggestedRole);
            }
            
            renderBulkAddTable();
            updateBulkAddCount();
            document.getElementById('bulkAddModal').classList.add('show');
        }
        
        function closeBulkAddModal() {
            document.getElementById('bulkAddModal').classList.remove('show');
            bulkAddCreators = [];
        }
        
        function suggestRoleByGmv(gmv) {
            const amount = parseFloat(gmv) || 0;
            if (amount >= 1000) return 'Closer';
            if (amount >= 500) return 'Closer';
            return 'Incubator';
        }
        
        function findCrossBrandMatch(creatorName) {
            const normalized = normalizeTikTok(creatorName);
            if (!normalized) return null;
            
            return managedCreators.find(mc => 
                normalizeTikTok(mc.account_1) === normalized ||
                normalizeTikTok(mc.account_2) === normalized ||
                normalizeTikTok(mc.account_3) === normalized ||
                normalizeTikTok(mc.account_4) === normalized ||
                normalizeTikTok(mc.account_5) === normalized
            );
        }
        
        function renderBulkAddTable() {
            const tbody = document.getElementById('bulkAddTableBody');
            tbody.innerHTML = bulkAddCreators.map((c, i) => `
                <tr style="border-bottom: 1px solid var(--border); ${c.crossBrandMatch ? 'background: var(--blue-dim);' : ''}">
                    <td style="padding: 10px;">
                        <input type="checkbox" ${c.selected ? 'checked' : ''} onchange="toggleBulkCreator(${i})">
                    </td>
                    <td style="padding: 10px;">
                        <a href="https://tiktok.com/@${c.creator_name}" target="_blank" style="color: var(--accent);">@${c.creator_name}</a>
                    </td>
                    <td style="padding: 10px;">
                        <span class="badge" style="background: var(--bg-secondary);">${BRAND_DISPLAY[c.brand] || c.brand}</span>
                    </td>
                    <td style="padding: 10px; text-align: right; font-weight: 600; color: var(--success);">
                        $${parseFloat(c.gmv || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>
                    <td style="padding: 10px;">
                        <input type="text" class="form-input" style="padding: 6px 10px; font-size: 0.85rem;" 
                            placeholder="Discord username" 
                            value="${c.discord || ''}"
                            onchange="updateBulkCreator(${i}, 'discord', this.value)"
                            list="discordSuggestions">
                    </td>
                    <td style="padding: 10px;">
                        <select class="form-input" style="padding: 6px 10px; font-size: 0.85rem;" onchange="updateBulkCreator(${i}, 'role', this.value)">
                            <option value="Incubator" ${c.role === 'Incubator' ? 'selected' : ''}>Incubator</option>
                            <option value="Closer" ${c.role === 'Closer' ? 'selected' : ''}>Closer</option>
                            <option value="Creatives" ${c.role === 'Creatives' ? 'selected' : ''}>Creatives</option>
                        </select>
                    </td>
                    <td style="padding: 10px; text-align: center;">
                        ${c.crossBrandMatch ? `
                            <button class="btn btn-small" style="padding: 4px 8px; font-size: 0.75rem; background: var(--blue); color: white;" 
                                onclick="applyBulkMatch(${i})" title="Copy from ${BRAND_DISPLAY[c.crossBrandMatch.brand]}">
                                📋
                            </button>
                        ` : '<span style="color: var(--text-muted);">—</span>'}
                    </td>
                </tr>
            `).join('');
            
            // Add datalist for Discord suggestions
            const existingDiscords = [...new Set(managedCreators.map(mc => mc.discord_name).filter(Boolean))];
            const datalist = document.createElement('datalist');
            datalist.id = 'discordSuggestions';
            datalist.innerHTML = existingDiscords.slice(0, 100).map(d => `<option value="${d}">`).join('');
            const existing = document.getElementById('discordSuggestions');
            if (existing) existing.remove();
            document.body.appendChild(datalist);
        }
        
        function toggleBulkCreator(index) {
            bulkAddCreators[index].selected = !bulkAddCreators[index].selected;
            updateBulkAddCount();
        }
        
        function toggleBulkSelectAll() {
            const checked = document.getElementById('bulkSelectAll').checked;
            bulkAddCreators.forEach(c => c.selected = checked);
            renderBulkAddTable();
            updateBulkAddCount();
        }
        
        function updateBulkCreator(index, field, value) {
            bulkAddCreators[index][field] = value;
            updateBulkAddCount();
        }
        
        function applyBulkMatch(index) {
            const match = bulkAddCreators[index].crossBrandMatch;
            if (!match) return;
            
            bulkAddCreators[index].discord = match.discord_name || '';
            bulkAddCreators[index].email = match.email || '';
            bulkAddCreators[index].realName = match.real_name || '';
            
            renderBulkAddTable();
            showToast(`Copied info from ${BRAND_DISPLAY[match.brand]} entry`, 'success');
        }
        
        function applyBulkRole() {
            const role = document.getElementById('bulkAddRole').value;
            bulkAddCreators.forEach(c => c.role = role);
            renderBulkAddTable();
        }
        
        function applyBulkStatus() {
            const status = document.getElementById('bulkAddStatus').value;
            bulkAddCreators.forEach(c => c.status = status);
        }
        
        function recalculateSuggestedRoles() {
            const autoSuggest = document.getElementById('bulkAutoSuggestRole').checked;
            if (autoSuggest) {
                bulkAddCreators.forEach(c => c.role = suggestRoleByGmv(c.gmv));
            } else {
                const defaultRole = document.getElementById('bulkAddRole').value;
                bulkAddCreators.forEach(c => c.role = defaultRole);
            }
            renderBulkAddTable();
        }
        
        function updateBulkAddCount() {
            const selected = bulkAddCreators.filter(c => c.selected);
            const missingDiscord = selected.filter(c => !c.discord || !c.discord.trim());
            
            document.getElementById('bulkAddCount').textContent = selected.length;
            
            if (missingDiscord.length > 0 && missingDiscord.length < selected.length) {
                document.getElementById('bulkAddWarning').style.display = 'inline';
                document.getElementById('bulkAddWarningCount').textContent = missingDiscord.length;
            } else {
                document.getElementById('bulkAddWarning').style.display = 'none';
            }
        }
        
        async function submitBulkAdd() {
            const selected = bulkAddCreators.filter(c => c.selected);
            if (selected.length === 0) {
                showToast('No creators selected', 'error');
                return;
            }
            
            // Check for missing Discord
            const missingDiscord = selected.filter(c => !c.discord || !c.discord.trim());
            if (missingDiscord.length > 0) {
                if (!confirm(`${missingDiscord.length} creator(s) are missing Discord names. They'll be harder to track. Continue anyway?`)) {
                    return;
                }
            }
            
            try {
                const records = selected.map(c => ({
                    brand: c.brand,
                    role: c.role,
                    status: c.status || 'Active',
                    account_1: normalizeTikTok(c.creator_name),
                    discord_name: c.discord?.trim() || null,
                    real_name: c.realName || null,
                    email: c.email || null,
                    notes: `Added from performance data on ${new Date().toLocaleDateString()}`
                }));
                
                const { error } = await supabaseClient.from('managed_creators').insert(records);
                
                if (error) throw error;
                
                showToast(`Added ${selected.length} creators to roster!`, 'success');
                logActivity('add', `Bulk added ${selected.length} creators to roster`);
                closeBulkAddModal();
                clearSelection();
                await loadManagedCreators();
                loadCreatorsData();
            } catch (err) {
                console.error('Error bulk adding:', err);
                showToast('Error adding creators: ' + err.message, 'error');
            }
        }
        
        async function addBulkWithoutDiscord() {
            const selected = bulkAddCreators.filter(c => c.selected);
            if (selected.length === 0) {
                showToast('No creators selected', 'error');
                return;
            }
            
            if (!confirm(`Quick add ${selected.length} creators without Discord info?`)) return;
            
            try {
                const records = selected.map(c => ({
                    brand: c.brand,
                    role: c.role,
                    status: c.status || 'Active',
                    account_1: normalizeTikTok(c.creator_name),
                    notes: `Quick added from performance data on ${new Date().toLocaleDateString()}`
                }));
                
                const { error } = await supabaseClient.from('managed_creators').insert(records);
                
                if (error) throw error;
                
                showToast(`Quick added ${selected.length} creators!`, 'success');
                closeBulkAddModal();
                clearSelection();
                await loadManagedCreators();
                loadCreatorsData();
            } catch (err) {
                console.error('Error quick adding:', err);
                showToast('Error adding creators: ' + err.message, 'error');
            }
        }
        
        // ==================== CSV IMPORT ====================
        let csvImportData = [];
        
        function openCSVImportModal() {
            document.getElementById('csvImportModal').classList.add('show');
            document.getElementById('csvPreviewSection').style.display = 'none';
            document.getElementById('csvFileInput').value = '';
            csvImportData = [];
        }
        
        function closeCSVImportModal() {
            document.getElementById('csvImportModal').classList.remove('show');
            csvImportData = [];
        }
        
        function downloadCSVTemplate() {
            const template = 'tiktok,discord,name,email,brand,role\nexample_user,ExampleDiscord#1234,John Doe,john@email.com,catakor,Incubator\n';
            const blob = new Blob([template], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'roster-import-template.csv';
            a.click();
            URL.revokeObjectURL(url);
        }
        
        function handleCSVUpload(event) {
            const file = event.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const csv = e.target.result;
                    parseCSV(csv);
                } catch (err) {
                    showToast('Error reading CSV: ' + err.message, 'error');
                }
            };
            reader.readAsText(file);
        }
        
        function parseCSV(csv) {
            const lines = csv.split('\n').map(l => l.trim()).filter(l => l);
            if (lines.length < 2) {
                showToast('CSV must have at least a header row and one data row', 'error');
                return;
            }
            
            // Parse header
            const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
            const tiktokCol = headers.findIndex(h => ['tiktok', 'tiktok_handle', 'handle', 'account', 'username'].includes(h));
            const discordCol = headers.findIndex(h => ['discord', 'discord_name', 'discord_username'].includes(h));
            const nameCol = headers.findIndex(h => ['name', 'real_name', 'full_name'].includes(h));
            const emailCol = headers.findIndex(h => ['email', 'email_address'].includes(h));
            const brandCol = headers.findIndex(h => ['brand'].includes(h));
            const roleCol = headers.findIndex(h => ['role'].includes(h));
            
            if (tiktokCol === -1) {
                showToast('CSV must have a "tiktok" column', 'error');
                return;
            }
            
            // Parse rows
            csvImportData = [];
            const defaultBrand = document.getElementById('rosterBrandFilter')?.value || 'catakor';
            
            for (let i = 1; i < lines.length; i++) {
                const values = parseCSVLine(lines[i]);
                if (!values[tiktokCol]) continue;
                
                csvImportData.push({
                    tiktok: normalizeTikTok(values[tiktokCol]) || values[tiktokCol],
                    discord: discordCol >= 0 ? values[discordCol] : '',
                    name: nameCol >= 0 ? values[nameCol] : '',
                    email: emailCol >= 0 ? values[emailCol] : '',
                    brand: brandCol >= 0 && values[brandCol] ? values[brandCol].toLowerCase().replace(/[^a-z_]/g, '_') : defaultBrand,
                    role: roleCol >= 0 && values[roleCol] ? values[roleCol] : 'Incubator'
                });
            }
            
            // Show preview
            document.getElementById('csvPreviewSection').style.display = 'block';
            document.getElementById('csvPreviewCount').textContent = csvImportData.length;
            
            // Render preview table (first 5 rows)
            const previewHead = document.getElementById('csvPreviewHead');
            const previewBody = document.getElementById('csvPreviewBody');
            
            previewHead.innerHTML = `<tr style="background: var(--bg-secondary);">
                <th style="padding: 8px; text-align: left;">TikTok</th>
                <th style="padding: 8px; text-align: left;">Discord</th>
                <th style="padding: 8px; text-align: left;">Name</th>
                <th style="padding: 8px; text-align: left;">Brand</th>
                <th style="padding: 8px; text-align: left;">Role</th>
            </tr>`;
            
            previewBody.innerHTML = csvImportData.slice(0, 5).map(row => `
                <tr style="border-bottom: 1px solid var(--border);">
                    <td style="padding: 8px;">@${row.tiktok}</td>
                    <td style="padding: 8px;">${row.discord || '<span style="color: var(--text-muted);">—</span>'}</td>
                    <td style="padding: 8px;">${row.name || '<span style="color: var(--text-muted);">—</span>'}</td>
                    <td style="padding: 8px;">${BRAND_DISPLAY[row.brand] || row.brand}</td>
                    <td style="padding: 8px;">${row.role}</td>
                </tr>
            `).join('');
            
            if (csvImportData.length > 5) {
                previewBody.innerHTML += `<tr><td colspan="5" style="padding: 8px; text-align: center; color: var(--text-muted);">... and ${csvImportData.length - 5} more</td></tr>`;
            }
            
            // Check for existing/duplicates
            const existing = csvImportData.filter(row => {
                return managedCreators.some(mc => 
                    mc.brand === row.brand && (
                        normalizeTikTok(mc.account_1) === row.tiktok ||
                        normalizeTikTok(mc.account_2) === row.tiktok ||
                        normalizeTikTok(mc.account_3) === row.tiktok
                    )
                );
            });
            
            const newRows = csvImportData.length - existing.length;
            
            document.getElementById('csvImportStats').innerHTML = `
                <div style="display: flex; gap: 24px;">
                    <div><strong style="color: var(--success);">${newRows}</strong> new creators</div>
                    <div><strong style="color: var(--warning);">${existing.length}</strong> already in roster (will skip)</div>
                </div>
            `;
            
            document.getElementById('csvImportBtn').disabled = newRows === 0;
        }
        
        function parseCSVLine(line) {
            const result = [];
            let current = '';
            let inQuotes = false;
            
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    result.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            }
            result.push(current.trim());
            return result;
        }
        
        async function executeCSVImport() {
            if (csvImportData.length === 0) {
                showToast('No data to import', 'error');
                return;
            }
            
            // Filter out existing
            const toImport = csvImportData.filter(row => {
                return !managedCreators.some(mc => 
                    mc.brand === row.brand && (
                        normalizeTikTok(mc.account_1) === row.tiktok ||
                        normalizeTikTok(mc.account_2) === row.tiktok ||
                        normalizeTikTok(mc.account_3) === row.tiktok
                    )
                );
            });
            
            if (toImport.length === 0) {
                showToast('All creators already in roster', 'info');
                return;
            }
            
            if (!confirm(`Import ${toImport.length} new creators?`)) return;
            
            try {
                const records = toImport.map(row => ({
                    brand: row.brand,
                    role: row.role,
                    status: 'Active',
                    account_1: row.tiktok,
                    discord_name: row.discord || null,
                    real_name: row.name || null,
                    email: row.email || null,
                    notes: `Imported via CSV on ${new Date().toLocaleDateString()}`
                }));
                
                const { error } = await supabaseClient.from('managed_creators').insert(records);
                
                if (error) throw error;
                
                showToast(`Imported ${toImport.length} creators!`, 'success');
                logActivity('add', `CSV imported ${toImport.length} creators`);
                closeCSVImportModal();
                await loadManagedCreators();
                loadRosterData();
            } catch (err) {
                console.error('Error importing CSV:', err);
                showToast('Import failed: ' + err.message, 'error');
            }
        }
        
        // Drag and drop for CSV
        document.addEventListener('DOMContentLoaded', () => {
            const dropZone = document.getElementById('csvDropZone');
            if (dropZone) {
                dropZone.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    dropZone.style.borderColor = 'var(--accent)';
                    dropZone.style.background = 'var(--accent-dim)';
                });
                dropZone.addEventListener('dragleave', () => {
                    dropZone.style.borderColor = 'var(--border)';
                    dropZone.style.background = 'transparent';
                });
                dropZone.addEventListener('drop', (e) => {
                    e.preventDefault();
                    dropZone.style.borderColor = 'var(--border)';
                    dropZone.style.background = 'transparent';
                    const file = e.dataTransfer.files[0];
                    if (file && file.name.endsWith('.csv')) {
                        document.getElementById('csvFileInput').files = e.dataTransfer.files;
                        handleCSVUpload({ target: { files: [file] } });
                    } else {
                        showToast('Please drop a CSV file', 'error');
                    }
                });
            }
        });

        // Search input debounce
        let creatorsSearchTimeout;
        document.getElementById('creatorsSearchInput').addEventListener('input', () => {
            clearTimeout(creatorsSearchTimeout);
            creatorsSearchTimeout = setTimeout(() => {
                pages.creators = 1;
                loadCreatorsData();
            }, 300);
        });

        // ==================== CREATOR LEADERBOARD ====================
        let leaderboardPeriod = 'week';
        let leaderboardData = [];
        
        function toggleCreatorsView(view) {
            const tableContainer = document.getElementById('creatorsTable');
            const leaderboardContainer = document.getElementById('creatorsLeaderboard');
            const toggleBtns = document.querySelectorAll('#view-creators .view-toggle-btn');
            
            toggleBtns.forEach(btn => btn.classList.remove('active'));
            event.target.classList.add('active');
            
            if (view === 'leaderboard') {
                tableContainer.classList.remove('active');
                tableContainer.style.display = 'none';
                leaderboardContainer.classList.add('active');
                leaderboardContainer.style.display = 'block';
                loadLeaderboard(leaderboardPeriod);
            } else {
                leaderboardContainer.classList.remove('active');
                leaderboardContainer.style.display = 'none';
                tableContainer.classList.add('active');
                tableContainer.style.display = 'block';
            }
        }
        
        async function loadLeaderboard(period) {
            if (period) {
                leaderboardPeriod = period;
                // Update active button
                document.querySelectorAll('.leaderboard-period-btn').forEach(btn => {
                    btn.classList.toggle('active', btn.textContent.toLowerCase().includes(period === 'alltime' ? 'all time' : period));
                });
            }
            
            // Update period label for download card
            const periodLabels = {
                'week': 'This Week',
                'month': 'This Month',
                'quarter': 'This Quarter',
                'alltime': 'All Time'
            };
            const periodLabel = document.getElementById('podiumPeriodLabel');
            if (periodLabel) {
                const brandFilter = document.getElementById('leaderboardBrandFilter')?.value || 'all';
                const brandText = brandFilter !== 'all' ? ` • ${BRAND_DISPLAY[brandFilter] || brandFilter}` : '';
                periodLabel.textContent = (periodLabels[leaderboardPeriod] || 'This Week') + brandText;
            }
            
            const brand = document.getElementById('leaderboardBrandFilter')?.value || 'all';
            
            // Calculate date range
            const now = new Date();
            let startDate, endDate;
            endDate = now.toISOString().split('T')[0];
            
            switch(leaderboardPeriod) {
                case 'week':
                    const weekStart = new Date(now);
                    weekStart.setDate(now.getDate() - now.getDay());
                    startDate = weekStart.toISOString().split('T')[0];
                    break;
                case 'month':
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
                    break;
                case 'quarter':
                    const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
                    startDate = quarterStart.toISOString().split('T')[0];
                    break;
                case 'alltime':
                    startDate = '2020-01-01';
                    break;
            }
            
            try {
                // Fetch aggregated creator data with pagination
                let allData = [];
                let page = 0;
                let hasMore = true;
                
                while (hasMore) {
                    let query = supabaseClient
                        .from('creator_performance')
                        .select('creator_name, brand, gmv, orders')
                        .gte('report_date', startDate)
                        .lte('report_date', endDate)
                        .range(page * 1000, (page + 1) * 1000 - 1);
                    
                    if (brand !== 'all') {
                        query = query.eq('brand', brand);
                    }
                    
                    const { data, error } = await query;
                    if (error) throw error;
                    
                    if (data && data.length > 0) {
                        allData = allData.concat(data);
                        hasMore = data.length === 1000;
                        page++;
                    } else {
                        hasMore = false;
                    }
                }
                
                // Aggregate by creator
                const creatorMap = {};
                allData.forEach(row => {
                    const key = row.creator_name;
                    if (!creatorMap[key]) {
                        creatorMap[key] = {
                            name: row.creator_name,
                            brand: row.brand,
                            gmv: 0,
                            orders: 0
                        };
                    }
                    creatorMap[key].gmv += parseFloat(row.gmv) || 0;
                    creatorMap[key].orders += parseInt(row.orders) || 0;
                });
                
                // Convert to array and sort by GMV
                leaderboardData = Object.values(creatorMap)
                    .sort((a, b) => b.gmv - a.gmv)
                    .slice(0, 50); // Top 50
                
                renderLeaderboard();
                
            } catch (err) {
                console.error('Error loading leaderboard:', err);
                showToast('Error loading leaderboard', 'error');
            }
        }
        
        function renderLeaderboard() {
            // Render podium (top 3)
            const podium = document.getElementById('leaderboardPodium');
            if (podium && leaderboardData.length >= 3) {
                const places = ['second', 'first', 'third'];
                const indices = [1, 0, 2];
                const icons = ['🥈', '👑', '🥉'];
                const baseIcons = ['🥈', '🏆', '🥉'];
                
                podium.innerHTML = indices.map((idx, i) => {
                    const creator = leaderboardData[idx];
                    if (!creator) return '';
                    return `
                        <div class="podium-place ${places[i]}">
                            <div class="podium-avatar">${icons[i]}<div class="podium-rank">${idx + 1}</div></div>
                            <div class="podium-name" title="${creator.name}">${creator.name}</div>
                            <div class="podium-gmv">${fmtMoney(creator.gmv)}</div>
                            <div class="podium-brand">${BRAND_DISPLAY[creator.brand] || creator.brand}</div>
                            <div class="podium-base">${baseIcons[i]}</div>
                        </div>
                    `;
                }).join('');
            } else if (podium) {
                podium.innerHTML = '<div style="padding: 40px; text-align: center; color: var(--text-muted);">Not enough data for podium</div>';
            }
            
            // Render list (4th place and beyond)
            const list = document.getElementById('leaderboardList');
            if (!list) return;
            
            const restOfList = leaderboardData.slice(3);
            
            if (restOfList.length === 0) {
                list.innerHTML = '<div style="padding: 40px; text-align: center; color: var(--text-muted);">No additional creators to display</div>';
                return;
            }
            
            list.innerHTML = restOfList.map((creator, idx) => {
                const rank = idx + 4;
                return `
                    <div class="leaderboard-item">
                        <div class="leaderboard-rank">${rank}</div>
                        <div class="leaderboard-creator">
                            <div class="leaderboard-avatar">${getCreatorEmoji(creator.name)}</div>
                            <div class="leaderboard-info">
                                <div class="leaderboard-name">${creator.name}</div>
                                <div class="leaderboard-brand">${BRAND_DISPLAY[creator.brand] || creator.brand}</div>
                            </div>
                        </div>
                        <div class="leaderboard-stats">
                            <div class="leaderboard-stat gmv">
                                <div class="value">${fmtMoney(creator.gmv)}</div>
                                <div class="label">GMV</div>
                            </div>
                            <div class="leaderboard-stat">
                                <div class="value">${(creator.orders || 0).toLocaleString()}</div>
                                <div class="label">Orders</div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }
        
        function getCreatorEmoji(name) {
            // Generate consistent emoji based on name
            const emojis = ['🎬', '🌟', '✨', '🎯', '🔥', '💫', '⭐', '🚀', '💪', '🎭'];
            const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
            return emojis[hash % emojis.length];
        }
        
        async function downloadPodiumImage() {
            if (leaderboardData.length < 3) {
                showToast('Need at least 3 creators for podium image', 'warning');
                return;
            }
            
            showToast('Creating high-quality image...', 'info');
            
            try {
                const width = 800;
                const height = 500;
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                
                const creators = [
                    { ...leaderboardData[0], place: 1 },
                    { ...leaderboardData[1], place: 2 },
                    { ...leaderboardData[2], place: 3 }
                ];
                
                const periodLabels = { week: 'This Week', month: 'This Month', quarter: 'This Quarter', alltime: 'All Time' };
                const periodText = periodLabels[leaderboardPeriod] || 'This Week';
                const brandFilter = document.getElementById('leaderboardBrandFilter')?.value || 'all';
                const brandText = brandFilter !== 'all' ? BRAND_DISPLAY[brandFilter] || brandFilter : 'All Brands';
                
                // === BACKGROUND ===
                const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
                bgGrad.addColorStop(0, '#1a1a2e');
                bgGrad.addColorStop(1, '#16213e');
                ctx.fillStyle = bgGrad;
                ctx.fillRect(0, 0, width, height);
                
                // Subtle glow at top
                const glow = ctx.createRadialGradient(width/2, 0, 0, width/2, 0, 300);
                glow.addColorStop(0, 'rgba(255, 215, 0, 0.1)');
                glow.addColorStop(1, 'rgba(255, 215, 0, 0)');
                ctx.fillStyle = glow;
                ctx.fillRect(0, 0, width, height);
                
                // === HEADER ===
                ctx.textAlign = 'center';
                ctx.fillStyle = '#ffd700';
                ctx.font = 'bold 32px Arial';
                ctx.fillText('🏆 TOP CREATORS 🏆', width/2, 45);
                
                ctx.fillStyle = '#8899aa';
                ctx.font = '14px Arial';
                ctx.fillText(periodText + ' • ' + brandText, width/2, 70);
                
                // === PODIUM CONFIG ===
                const podiumBase = 400; // Y position of podium bottom
                const podiums = [
                    { x: width/2, h: 140, w: 140, color: '#ffd700', darkColor: '#b8860b', idx: 0 },      // 1st - center
                    { x: width/2 - 170, h: 100, w: 120, color: '#c0c0c0', darkColor: '#808080', idx: 1 }, // 2nd - left
                    { x: width/2 + 170, h: 70, w: 120, color: '#cd7f32', darkColor: '#8b4513', idx: 2 }   // 3rd - right
                ];
                
                // Draw podiums back to front (3rd, 2nd, 1st)
                [2, 1, 0].forEach(i => {
                    const pod = podiums[i];
                    const creator = creators[pod.idx];
                    const podTop = podiumBase - pod.h;
                    
                    // Shadow
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
                    ctx.beginPath();
                    ctx.ellipse(pod.x, podiumBase + 10, pod.w/2 + 5, 8, 0, 0, Math.PI * 2);
                    ctx.fill();
                    
                    // Podium body with 3D gradient
                    const podGrad = ctx.createLinearGradient(pod.x - pod.w/2, 0, pod.x + pod.w/2, 0);
                    podGrad.addColorStop(0, pod.darkColor);
                    podGrad.addColorStop(0.2, pod.color);
                    podGrad.addColorStop(0.8, pod.color);
                    podGrad.addColorStop(1, pod.darkColor);
                    ctx.fillStyle = podGrad;
                    
                    // Rounded top podium
                    ctx.beginPath();
                    const r = 10;
                    ctx.moveTo(pod.x - pod.w/2 + r, podTop);
                    ctx.lineTo(pod.x + pod.w/2 - r, podTop);
                    ctx.quadraticCurveTo(pod.x + pod.w/2, podTop, pod.x + pod.w/2, podTop + r);
                    ctx.lineTo(pod.x + pod.w/2, podiumBase);
                    ctx.lineTo(pod.x - pod.w/2, podiumBase);
                    ctx.lineTo(pod.x - pod.w/2, podTop + r);
                    ctx.quadraticCurveTo(pod.x - pod.w/2, podTop, pod.x - pod.w/2 + r, podTop);
                    ctx.closePath();
                    ctx.fill();
                    
                    // Top highlight
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                    ctx.fillRect(pod.x - pod.w/2 + 5, podTop + 3, pod.w - 10, 6);
                    
                    // Place number
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
                    ctx.font = 'bold 50px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText(creator.place, pod.x, podiumBase - 25);
                    
                    // === CREATOR INFO (above podium) ===
                    const infoY = podTop - 20; // Base Y for info, above podium
                    
                    // Avatar circle
                    const avatarSize = i === 0 ? 40 : 32;
                    const avatarY = infoY - 50;
                    
                    ctx.beginPath();
                    ctx.arc(pod.x, avatarY, avatarSize, 0, Math.PI * 2);
                    ctx.fillStyle = '#2a2f4a';
                    ctx.fill();
                    ctx.strokeStyle = pod.color;
                    ctx.lineWidth = 3;
                    ctx.stroke();
                    
                    // Medal emoji in avatar
                    const medals = ['🥇', '🥈', '🥉'];
                    ctx.font = i === 0 ? '35px Arial' : '28px Arial';
                    ctx.fillText(medals[pod.idx], pod.x, avatarY + (i === 0 ? 12 : 10));
                    
                    // Creator name
                    ctx.fillStyle = '#ffffff';
                    ctx.font = i === 0 ? 'bold 16px Arial' : '14px Arial';
                    const displayName = creator.name.length > 15 ? creator.name.substring(0, 13) + '..' : creator.name;
                    ctx.fillText(displayName, pod.x, avatarY - avatarSize - 12);
                    
                    // GMV
                    ctx.fillStyle = '#4ade80';
                    ctx.font = i === 0 ? 'bold 20px Arial' : 'bold 16px Arial';
                    ctx.fillText(fmtMoney(creator.gmv), pod.x, avatarY + avatarSize + 22);
                    
                    // Orders
                    ctx.fillStyle = '#8899aa';
                    ctx.font = '11px Arial';
                    ctx.fillText((creator.orders || 0).toLocaleString() + ' orders', pod.x, avatarY + avatarSize + 38);
                });
                
                // === SPARKLES ===
                const sparklePositions = [
                    {x: 80, y: 150}, {x: 720, y: 180}, {x: 60, y: 320}, {x: 740, y: 350}
                ];
                ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
                sparklePositions.forEach(sp => {
                    ctx.beginPath();
                    ctx.moveTo(sp.x, sp.y - 6);
                    ctx.lineTo(sp.x + 2, sp.y - 2);
                    ctx.lineTo(sp.x + 6, sp.y);
                    ctx.lineTo(sp.x + 2, sp.y + 2);
                    ctx.lineTo(sp.x, sp.y + 6);
                    ctx.lineTo(sp.x - 2, sp.y + 2);
                    ctx.lineTo(sp.x - 6, sp.y);
                    ctx.lineTo(sp.x - 2, sp.y - 2);
                    ctx.closePath();
                    ctx.fill();
                });
                
                // === FOOTER ===
                ctx.fillStyle = '#556677';
                ctx.font = '12px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('Creators Corner • Keep crushing it! 💪', width/2, height - 25);
                
                ctx.fillStyle = '#334455';
                ctx.font = '10px Arial';
                ctx.fillText(new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), width/2, height - 10);
                
                // === DOWNLOAD ===
                canvas.toBlob(function(blob) {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'leaderboard-' + (leaderboardPeriod || 'week') + '-' + new Date().toISOString().split('T')[0] + '.png';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    showToast('Image downloaded! 🎉', 'success');
                }, 'image/png');
                
            } catch (err) {
                console.error('Error generating image:', err);
                showToast('Error: ' + err.message, 'error');
            }
        }
        
        // Animated GIF - Clean version with proper positioning
        async function downloadPodiumGif() {
            if (leaderboardData.length < 3) {
                showToast('Need at least 3 creators for animated GIF', 'warning');
                return;
            }
            showToast('Creating animated GIF... ~10 seconds 🎬', 'info');
            
            try {
                const width = 600, height = 400, totalFrames = 25;
                const creators = [
                    { ...leaderboardData[0], place: 1 },
                    { ...leaderboardData[1], place: 2 },
                    { ...leaderboardData[2], place: 3 }
                ];
                const periodText = { week: 'This Week', month: 'This Month', quarter: 'This Quarter', alltime: 'All Time' }[leaderboardPeriod] || 'This Week';
                const brandFilter = document.getElementById('leaderboardBrandFilter')?.value || 'all';
                const brandText = brandFilter !== 'all' ? BRAND_DISPLAY[brandFilter] || brandFilter : 'All Brands';
                
                const canvas = document.createElement('canvas');
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                
                function easeOutBounce(t) { 
                    if (t < 1/2.75) return 7.5625*t*t; 
                    if (t < 2/2.75) return 7.5625*(t-=1.5/2.75)*t+.75; 
                    if (t < 2.5/2.75) return 7.5625*(t-=2.25/2.75)*t+.9375; 
                    return 7.5625*(t-=2.625/2.75)*t+.984375; 
                }
                
                const confetti = Array.from({length: 30}, () => ({ 
                    x: Math.random() * width, 
                    y: -20 - Math.random() * 80, 
                    vy: 3 + Math.random() * 3,
                    size: 5 + Math.random() * 6, 
                    color: ['#ffd700', '#ff6b6b', '#4ecdc4', '#45b7d1', '#96e6a1'][Math.floor(Math.random() * 5)] 
                }));
                
                const podiumBase = 320;
                const podiums = [
                    { x: width/2, h: 100, w: 110, delay: 0, color: '#ffd700', darkColor: '#b8860b' },
                    { x: width/2 - 130, h: 70, w: 95, delay: 3, color: '#c0c0c0', darkColor: '#808080' },
                    { x: width/2 + 130, h: 50, w: 95, delay: 6, color: '#cd7f32', darkColor: '#8b4513' }
                ];
                
                const frames = [];
                
                for (let f = 0; f < totalFrames; f++) {
                    // Background
                    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
                    bgGrad.addColorStop(0, '#1a1a2e');
                    bgGrad.addColorStop(1, '#16213e');
                    ctx.fillStyle = bgGrad;
                    ctx.fillRect(0, 0, width, height);
                    
                    // Confetti after frame 8
                    if (f > 8) {
                        confetti.forEach(c => {
                            c.y += c.vy;
                            if (c.y < height + 10) {
                                ctx.fillStyle = c.color;
                                ctx.globalAlpha = 0.85;
                                ctx.fillRect(c.x, c.y, c.size, c.size * 0.6);
                                ctx.globalAlpha = 1;
                            }
                        });
                    }
                    
                    // Header
                    const headerAlpha = Math.min(1, f / 6);
                    ctx.globalAlpha = headerAlpha;
                    ctx.textAlign = 'center';
                    ctx.fillStyle = '#ffd700';
                    ctx.font = 'bold 24px Arial';
                    ctx.fillText('TOP CREATORS', width/2, 35);
                    ctx.fillStyle = '#8899aa';
                    ctx.font = '12px Arial';
                    ctx.fillText(periodText + ' - ' + brandText, width/2, 55);
                    ctx.globalAlpha = 1;
                    
                    // Draw podiums
                    [2, 1, 0].forEach(i => {
                        const pod = podiums[i];
                        const creator = creators[i];
                        const prog = Math.min(1, Math.max(0, (f - pod.delay) / 10));
                        const bounce = easeOutBounce(prog);
                        const h = pod.h * bounce;
                        const top = podiumBase - h;
                        
                        // Shadow
                        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
                        ctx.beginPath();
                        ctx.ellipse(pod.x, podiumBase + 8, pod.w/2 + 3, 6, 0, 0, Math.PI * 2);
                        ctx.fill();
                        
                        // Podium with gradient
                        const podGrad = ctx.createLinearGradient(pod.x - pod.w/2, 0, pod.x + pod.w/2, 0);
                        podGrad.addColorStop(0, pod.darkColor);
                        podGrad.addColorStop(0.3, pod.color);
                        podGrad.addColorStop(0.7, pod.color);
                        podGrad.addColorStop(1, pod.darkColor);
                        ctx.fillStyle = podGrad;
                        ctx.globalAlpha = 0.5 + 0.5 * prog;
                        
                        // Rounded podium
                        ctx.beginPath();
                        const r = 6;
                        ctx.moveTo(pod.x - pod.w/2 + r, top);
                        ctx.lineTo(pod.x + pod.w/2 - r, top);
                        ctx.quadraticCurveTo(pod.x + pod.w/2, top, pod.x + pod.w/2, top + r);
                        ctx.lineTo(pod.x + pod.w/2, podiumBase);
                        ctx.lineTo(pod.x - pod.w/2, podiumBase);
                        ctx.lineTo(pod.x - pod.w/2, top + r);
                        ctx.quadraticCurveTo(pod.x - pod.w/2, top, pod.x - pod.w/2 + r, top);
                        ctx.closePath();
                        ctx.fill();
                        
                        // Highlight
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
                        ctx.fillRect(pod.x - pod.w/2 + 4, top + 2, pod.w - 8, 4);
                        
                        // Place number
                        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
                        ctx.font = 'bold 36px Arial';
                        ctx.globalAlpha = prog;
                        ctx.fillText(creator.place, pod.x, podiumBase - 15);
                        
                        // Creator info (above podium)
                        if (prog > 0.5) {
                            const infoAlpha = (prog - 0.5) * 2;
                            ctx.globalAlpha = infoAlpha;
                            
                            const avatarY = top - 35;
                            const avatarSize = i === 0 ? 28 : 24;
                            
                            // Avatar circle
                            ctx.beginPath();
                            ctx.arc(pod.x, avatarY, avatarSize, 0, Math.PI * 2);
                            ctx.fillStyle = '#2a2f4a';
                            ctx.fill();
                            ctx.strokeStyle = pod.color;
                            ctx.lineWidth = 2;
                            ctx.stroke();
                            
                            // Medal
                            const medals = ['🥇', '🥈', '🥉'];
                            ctx.font = i === 0 ? '24px Arial' : '20px Arial';
                            ctx.fillText(medals[i], pod.x, avatarY + (i === 0 ? 8 : 7));
                            
                            // Name above avatar
                            ctx.fillStyle = '#ffffff';
                            ctx.font = i === 0 ? 'bold 13px Arial' : '11px Arial';
                            const name = creator.name.length > 12 ? creator.name.slice(0, 10) + '..' : creator.name;
                            ctx.fillText(name, pod.x, avatarY - avatarSize - 8);
                            
                            // GMV below avatar
                            ctx.fillStyle = '#4ade80';
                            ctx.font = i === 0 ? 'bold 15px Arial' : 'bold 12px Arial';
                            ctx.fillText(fmtMoney(creator.gmv), pod.x, avatarY + avatarSize + 16);
                        }
                        ctx.globalAlpha = 1;
                    });
                    
                    // Footer
                    ctx.globalAlpha = Math.min(1, f / 10);
                    ctx.fillStyle = '#556677';
                    ctx.font = '10px Arial';
                    ctx.fillText('Creators Corner', width/2, height - 15);
                    ctx.globalAlpha = 1;
                    
                    frames.push(ctx.getImageData(0, 0, width, height));
                }
                
                // Minified GIF encoder
                const workerCode = 'self.onmessage=function(e){const{frames:t,width:n,height:r,delay:i}=e.data,o=[];o.push(71,73,70,56,57,97),o.push(255&n,n>>8&255),o.push(255&r,r>>8&255),o.push(247,0,0);for(let e=0;e<256;e++)o.push(e,e,e);o.push(33,255,11,78,69,84,83,67,65,80,69,50,46,48,3,1,0,0,0),t.forEach((e,s)=>{const a=new Uint8Array(e),l=new Map,c=[],u=new Uint8Array(n*r);for(let e=0;e<a.length;e+=4){const t=a[e],n=a[e+1],r=a[e+2],i=8*Math.floor(t/8),o=8*Math.floor(n/8),s=8*Math.floor(r/8),f=i<<16|o<<8|s;l.has(f)||c.length>=256||(l.set(f,c.length),c.push([i,o,s])),u[e/4]=l.get(f)||0}for(;c.length<256;)c.push([0,0,0]);const f=s<t.length-3?i:4*i;o.push(33,249,4,4,255&f,f>>8&255,0,0),o.push(44,0,0,0,0),o.push(255&n,n>>8&255,255&r,r>>8&255),o.push(135),c.forEach(e=>o.push(e[0],e[1],e[2])),o.push(8);const h=d(u,8);let p=0;for(;p<h.length;){const e=Math.min(255,h.length-p);o.push(e);for(let t=0;t<e;t++)o.push(h[p++])}o.push(0)}),o.push(59),self.postMessage(new Uint8Array(o))};function d(e,t){const n=1<<t,r=n+1,i=[];let o=t+1,s=r+1;const a=new Map;let l=0,c=0;function u(e,t){for(l|=e<<c,c+=t;c>=8;)i.push(255&l),l>>=8,c-=8}for(let e=0;e<n;e++)a.set(String(e),e);u(n,o);let f=String(e[0]);for(let t=1;t<e.length;t++){const n=String(e[t]),r=f+","+n;a.has(r)?f=r:(u(a.get(f),o),s<4096&&(a.set(r,s++),s>1<<o&&o<12&&o++),f=n)}return u(a.get(f),o),u(r,o),c>0&&i.push(255&l),i}';
                
                const workerBlob = new Blob([workerCode], { type: 'application/javascript' });
                const worker = new Worker(URL.createObjectURL(workerBlob));
                
                worker.onmessage = function(e) {
                    const blob = new Blob([e.data], { type: 'image/gif' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'leaderboard-' + (leaderboardPeriod||'week') + '-' + new Date().toISOString().split('T')[0] + '.gif';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    worker.terminate();
                    showToast('GIF downloaded! 🎬🎉', 'success');
                };
                
                worker.onerror = function(err) {
                    console.error('Worker error:', err);
                    worker.terminate();
                    showToast('Error creating GIF', 'error');
                };
                
                const frameData = frames.map(f => Array.from(f.data));
                worker.postMessage({ frames: frameData, width, height, delay: 10 });
                
            } catch (err) { 
                console.error('GIF error:', err); 
                showToast('Error: ' + err.message, 'error'); 
            }
        }
        // ==================== VIDEOS ====================
        let videosCache = { filtered: [] };
        
        async function loadVideosData() {
            showLoading('videos', 'Loading video data...');
            try {
            const brand = document.getElementById('videosBrandFilter').value;
            const startDate = document.getElementById('videosDateFilterStart').value;
            const endDate = document.getElementById('videosDateFilterEnd').value;
            const status = document.getElementById('videosStatusFilter').value;
            const search = document.getElementById('videosSearchInput').value.toLowerCase();

            if (!startDate || !endDate) { hideLoading('videos'); return; }

            // Calculate prior period dates
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
                let query = supabaseClient.from('video_performance')
                    .select('*')
                    .gte('report_date', startDate)
                    .lte('report_date', endDate)
                    .eq('period_type', 'daily')
                    .range(page * pageSize, (page + 1) * pageSize - 1);
                
                if (brand !== 'all') query = query.eq('brand', brand);
                
                const { data, error } = await query;
                
                if (error || !data || data.length === 0) {
                    hasMore = false;
                } else {
                    allData = allData.concat(data);
                    hasMore = data.length === pageSize;
                    page++;
                }
                if (page >= MAX_PAGES) break;
            }

            // Fetch prior period data for trend calculation
            let priorData = [];
            page = 0;
            hasMore = true;
            
            while (hasMore) {
                let query = supabaseClient.from('video_performance')
                    .select('*')
                    .gte('report_date', localDateStr(priorStart))
                    .lte('report_date', localDateStr(priorEnd))
                    .eq('period_type', 'daily')
                    .range(page * pageSize, (page + 1) * pageSize - 1);
                
                if (brand !== 'all') query = query.eq('brand', brand);
                
                const { data, error } = await query;
                
                if (error || !data || data.length === 0) {
                    hasMore = false;
                } else {
                    priorData = priorData.concat(data);
                    hasMore = data.length === pageSize;
                    page++;
                }
                if (page >= MAX_PAGES) break;
            }

            // Aggregate by video_id only (sum across dates and products)
            const videoMap = new Map();
            allData.forEach(row => {
                const key = row.video_id;
                if (!videoMap.has(key)) {
                    // Build proper TikTok URL from video_id and creator_name
                    const tiktokUrl = row.video_id ? `https://www.tiktok.com/@${row.creator_name}/video/${row.video_id}` : null;
                    videoMap.set(key, {
                        video_id: row.video_id,
                        video_title: row.video_title,
                        video_link: tiktokUrl,
                        creator_name: row.creator_name,
                        brand: row.brand,
                        gmv: 0, 
                        orders: 0, 
                        items_sold: 0,
                        products: new Set()
                    });
                }
                const v = videoMap.get(key);
                v.gmv += pFloat(row.gmv);
                v.orders += pInt(row.orders);
                v.items_sold += pInt(row.items_sold);
                if (row.product_name) v.products.add(row.product_name);
            });

            // Build videos array
            let videos = [...videoMap.values()].map(v => ({
                ...v,
                aov: v.orders > 0 ? v.gmv / v.orders : 0,
                managed: isManagedForBrand(v.creator_name, v.brand),
                productCount: v.products.size
            }));

            // Apply status filter
            if (status === 'managed') {
                videos = videos.filter(v => v.managed);
            } else if (status === 'unmanaged') {
                videos = videos.filter(v => !v.managed);
            }

            // Apply search filter
            if (search) {
                videos = videos.filter(v => 
                    v.video_title?.toLowerCase().includes(search) || 
                    v.creator_name?.toLowerCase().includes(search)
                );
            }

            // Sort by GMV
            videos.sort((a, b) => b.gmv - a.gmv);
            
            // Cache for export
            videosCache.filtered = videos;

            // Aggregate prior period by video for comparison
            const priorVideoMap = new Map();
            let filteredPriorData = priorData;
            if (status === 'managed') {
                filteredPriorData = priorData.filter(d => isManagedForBrand(d.creator_name, d.brand));
            } else if (status === 'unmanaged') {
                filteredPriorData = priorData.filter(d => !isManagedForBrand(d.creator_name, d.brand));
            }
            filteredPriorData.forEach(row => {
                const key = row.video_id;
                if (!priorVideoMap.has(key)) {
                    priorVideoMap.set(key, { gmv: 0, orders: 0, creator_name: row.creator_name });
                }
                const v = priorVideoMap.get(key);
                v.gmv += pFloat(row.gmv);
                v.orders += pInt(row.orders);
            });
            const priorVideos = [...priorVideoMap.values()];

            // Calculate current stats
            const totalGmv = videos.reduce((s, v) => s + v.gmv, 0);
            const totalOrders = videos.reduce((s, v) => s + v.orders, 0);
            const uniqueCreators = new Set(videos.map(v => v.creator_name)).size;
            const videosWithSales = videos.filter(v => v.gmv > 0).length;
            const conversionRate = videos.length > 0 ? (videosWithSales / videos.length * 100) : 0;
            const avgGmvPerVideo = videos.length ? totalGmv / videos.length : 0;

            // Calculate prior stats
            const priorGmv = priorVideos.reduce((s, v) => s + v.gmv, 0);
            const priorOrders = priorVideos.reduce((s, v) => s + v.orders, 0);
            const priorCreators = new Set(priorVideos.map(v => v.creator_name)).size;
            const priorVideosWithSales = priorVideos.filter(v => v.gmv > 0).length;
            const priorConversion = priorVideos.length > 0 ? (priorVideosWithSales / priorVideos.length * 100) : 0;
            const priorAvgGmv = priorVideos.length ? priorGmv / priorVideos.length : 0;

            // Update stats with trends
            document.getElementById('videosStatGmv').textContent = fmtMoney(totalGmv);
            updateTrendIndicator('videosStatGmvChange', totalGmv, priorGmv);
            
            document.getElementById('videosStatTotal').textContent = videos.length;
            updateTrendIndicator('videosStatTotalChange', videos.length, priorVideos.length);
            
            document.getElementById('videosStatCreators').textContent = uniqueCreators;
            updateTrendIndicator('videosStatCreatorsChange', uniqueCreators, priorCreators);
            
            document.getElementById('videosStatOrders').textContent = fmt(totalOrders);
            updateTrendIndicator('videosStatOrdersChange', totalOrders, priorOrders);
            
            document.getElementById('videosStatAvg').textContent = fmtMoney(avgGmvPerVideo);
            updateTrendIndicator('videosStatAvgChange', avgGmvPerVideo, priorAvgGmv);
            
            document.getElementById('videosStatConversion').textContent = conversionRate.toFixed(0) + '%';
            updateTrendIndicator('videosStatConversionChange', conversionRate, priorConversion);

            // Render insight cards
            renderVideoInsights(videos);

            // Update table count
            document.getElementById('videosTableCount').textContent = `${videos.length} videos`;

            // Paginate and render table
            const startIdx = (pages.videos - 1) * PAGE_SIZE;
            const pageData = videos.slice(startIdx, startIdx + PAGE_SIZE);

            document.getElementById('videosBody').innerHTML = pageData.map(v => {
                const hasVideo = v.video_id && v.video_id.toString().trim() !== '';
                const titleContent = hasVideo
                    ? `<span style="cursor: pointer; color: var(--text-primary); transition: color 0.2s;" onclick="openVideoEmbed('${v.video_id}', '${(v.video_title || 'Untitled').replace(/'/g, "\\'")}', ${v.gmv || 0}, ${v.orders || 0}, '${v.creator_name.replace(/'/g, "\\'")}')" onmouseover="this.style.color='var(--accent)'" onmouseout="this.style.color='var(--text-primary)'">${v.video_title || 'Untitled'} <span style="color: var(--accent); font-size: 0.8rem;">▶</span></span>`
                    : (v.video_title || 'Untitled');
                
                // Format product display - show first product with count if multiple
                const productsArray = [...(v.products || [])];
                let productDisplay = '';
                if (productsArray.length === 0) {
                    productDisplay = '<span style="color: var(--text-muted); font-size: 0.85rem;">—</span>';
                } else if (productsArray.length === 1) {
                    const shortName = productsArray[0].length > 25 ? productsArray[0].substring(0, 22) + '...' : productsArray[0];
                    productDisplay = `<span class="badge-product" title="${productsArray[0]}" style="font-size: 0.75rem; padding: 2px 8px; background: var(--purple-dim); color: var(--purple); border-radius: 4px;">${shortName}</span>`;
                } else {
                    const shortName = productsArray[0].length > 20 ? productsArray[0].substring(0, 17) + '...' : productsArray[0];
                    productDisplay = `<span class="badge-product" title="${productsArray.join(', ')}" style="font-size: 0.75rem; padding: 2px 8px; background: var(--purple-dim); color: var(--purple); border-radius: 4px;">${shortName} +${productsArray.length - 1}</span>`;
                }
                
                return `<tr>
                    <td><div style="max-width:280px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${titleContent}</div></td>
                    <td>
                        <span class="clickable-creator" onclick="openCreatorDetail('${v.creator_name.replace(/'/g, "\\'")}', '${v.brand}')" style="cursor:pointer; color:var(--text-primary); transition: color 0.2s;" onmouseover="this.style.color='var(--accent)'" onmouseout="this.style.color='var(--text-primary)'">${v.creator_name}</span>
                    </td>
                    <td><span class="badge-brand">${BRAND_DISPLAY[v.brand] || v.brand}</span></td>
                    <td>${productDisplay}</td>
                    <td><span class="badge ${v.managed ? 'badge-managed' : 'badge-unmanaged'}">${v.managed ? '✓' : '−'}</span></td>
                    <td><span class="gmv-value gmv-high">${fmtMoney(v.gmv)}</span></td>
                    <td>${fmt(v.orders)}</td>
                    <td>${fmt(v.items_sold)}</td>
                    <td>${fmtMoney(v.aov)}</td>
                </tr>`;
            }).join('') || '<tr><td colspan="9"><div class="empty-state"><h3>No videos found</h3><p>Try adjusting your filters</p></div></td></tr>';

            renderPagination('videosPagination', videos.length, pages.videos, (p) => { pages.videos = p; loadVideosData(); });
            } finally {
                hideLoading('videos');
            }
        }

        function renderVideoInsights(videos) {
            // Top Performing Videos - top 5 by GMV
            const topPerforming = videos.slice(0, 5);
            document.getElementById('videosTopPerforming').innerHTML = topPerforming.length ? topPerforming.map((v, i) => {
                const hasVideo = v.video_id && v.video_id.toString().trim() !== '';
                return `
                <div class="leaderboard-item" style="cursor: ${hasVideo ? 'pointer' : 'default'};" ${hasVideo ? `onclick="openVideoEmbed('${v.video_id}', '${(v.video_title || 'Untitled').replace(/'/g, "\\'")}', ${v.gmv || 0}, ${v.orders || 0}, '${v.creator_name.replace(/'/g, "\\'")}')"` : ''}>
                    <div class="leaderboard-rank">${i + 1}</div>
                    <div class="leaderboard-info">
                        <div class="leaderboard-name" style="max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${v.video_title || 'Untitled'}</div>
                        <div class="leaderboard-brand">${v.creator_name}</div>
                    </div>
                    <div class="leaderboard-value">${fmtMoney(v.gmv)}</div>
                </div>
            `;}).join('') : '<div class="empty-state" style="padding: 20px;"><p>No videos</p></div>';

            // Top Creators by Video GMV - aggregate by creator
            const creatorGmv = new Map();
            videos.forEach(v => {
                if (!creatorGmv.has(v.creator_name)) {
                    creatorGmv.set(v.creator_name, { name: v.creator_name, brand: v.brand, gmv: 0, videoCount: 0 });
                }
                const c = creatorGmv.get(v.creator_name);
                c.gmv += v.gmv;
                c.videoCount++;
            });
            const topCreators = [...creatorGmv.values()].sort((a, b) => b.gmv - a.gmv).slice(0, 5);
            
            document.getElementById('videosTopCreators').innerHTML = topCreators.length ? topCreators.map((c, i) => `
                <div class="leaderboard-item" onclick="openCreatorDetail('${c.name.replace(/'/g, "\\'")}', '${c.brand}')" style="cursor: pointer;">
                    <div class="leaderboard-rank">${i + 1}</div>
                    <div class="leaderboard-info">
                        <div class="leaderboard-name">${c.name}</div>
                        <div class="leaderboard-brand">${c.videoCount} videos</div>
                    </div>
                    <div class="leaderboard-value">${fmtMoney(c.gmv)}</div>
                </div>
            `).join('') : '<div class="empty-state" style="padding: 20px;"><p>No creators</p></div>';

            // Most Efficient - creators with best GMV per video (min 3 videos)
            const efficientCreators = [...creatorGmv.values()]
                .filter(c => c.videoCount >= 3)
                .map(c => ({ ...c, gmvPerVideo: c.gmv / c.videoCount }))
                .sort((a, b) => b.gmvPerVideo - a.gmvPerVideo)
                .slice(0, 5);
            
            document.getElementById('videosMostEfficient').innerHTML = efficientCreators.length ? efficientCreators.map(c => `
                <div class="leaderboard-item" onclick="openCreatorDetail('${c.name.replace(/'/g, "\\'")}', '${c.brand}')" style="cursor: pointer;">
                    <div class="leaderboard-info">
                        <div class="leaderboard-name">${c.name}</div>
                        <div class="leaderboard-brand">${c.videoCount} videos</div>
                    </div>
                    <div class="leaderboard-value">${fmtMoney(c.gmvPerVideo)}<span style="font-size: 0.7rem; color: var(--text-muted);">/vid</span></div>
                </div>
            `).join('') : '<div class="empty-state" style="padding: 20px;"><p>Min 3 videos required</p></div>';
        }

        function exportVideos() {
            if (!videosCache.filtered.length) {
                showToast('No data to export', 'error');
                return;
            }
            
            const headers = ['Video Title', 'Video ID', 'Creator', 'Brand', 'Status', 'GMV', 'Orders', 'Items', 'AOV', 'TikTok URL'];
            const rows = videosCache.filtered.map(v => {
                const tiktokUrl = v.video_id ? `https://www.tiktok.com/@${v.creator_name}/video/${v.video_id}` : '';
                return [
                    v.video_title || 'Untitled',
                    v.video_id || '',
                    v.creator_name,
                    BRAND_DISPLAY[v.brand] || v.brand,
                    v.managed ? 'Managed' : 'Unmanaged',
                    v.gmv.toFixed(2),
                    v.orders,
                    v.items_sold,
                    v.aov.toFixed(2),
                    tiktokUrl
                ];
            });
            
            const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `videos-export-${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            showToast(`Exported ${videosCache.filtered.length} videos!`, 'success');
        }

        // Search input debounce for videos
        let videosSearchTimeout;
        document.getElementById('videosSearchInput').addEventListener('input', () => {
            clearTimeout(videosSearchTimeout);
            videosSearchTimeout = setTimeout(() => {
                pages.videos = 1;
                loadVideosData();
            }, 300);
        });

        // ==================== PRODUCTS ====================
        let productsCache = { filtered: [] };
        let productsChannelChartInstance = null;
        
        async function loadProductsData() {
            showLoading('products', 'Loading product data...');
            try {
            const brand = document.getElementById('productsBrandFilter').value;
            const startDate = document.getElementById('productsDateFilterStart').value;
            const endDate = document.getElementById('productsDateFilterEnd').value;
            const search = document.getElementById('productsSearchInput')?.value?.toLowerCase() || '';

            if (!startDate || !endDate) { hideLoading('products'); return; }

            // Calculate prior period dates
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
                let query = supabaseClient.from('product_performance')
                    .select('*')
                    .gte('report_date', startDate)
                    .lte('report_date', endDate)
                    .eq('period_type', 'daily')
                    .range(page * pageSize, (page + 1) * pageSize - 1);
                
                if (brand !== 'all') query = query.eq('brand', brand);
                
                const { data, error } = await query;
                
                if (error || !data || data.length === 0) {
                    hasMore = false;
                } else {
                    allData = allData.concat(data);
                    hasMore = data.length === pageSize;
                    page++;
                }
                if (page >= MAX_PAGES) break;
            }

            // Fetch prior period data for trends
            let priorData = [];
            page = 0;
            hasMore = true;
            
            while (hasMore) {
                let query = supabaseClient.from('product_performance')
                    .select('*')
                    .gte('report_date', localDateStr(priorStart))
                    .lte('report_date', localDateStr(priorEnd))
                    .eq('period_type', 'daily')
                    .range(page * pageSize, (page + 1) * pageSize - 1);
                
                if (brand !== 'all') query = query.eq('brand', brand);
                
                const { data, error } = await query;
                
                if (error || !data || data.length === 0) {
                    hasMore = false;
                } else {
                    priorData = priorData.concat(data);
                    hasMore = data.length === pageSize;
                    page++;
                }
                if (page >= MAX_PAGES) break;
            }

            // Aggregate by product_id
            const productMap = new Map();
            allData.forEach(row => {
                const key = `${row.product_id}|||${row.brand}`;
                if (!productMap.has(key)) {
                    productMap.set(key, {
                        product_id: row.product_id,
                        product_name: row.product_name,
                        brand: row.brand,
                        status: row.status,
                        gmv: 0, orders: 0, items_sold: 0,
                        video_gmv: 0, live_gmv: 0, shop_tab_gmv: 0
                    });
                }
                const p = productMap.get(key);
                p.gmv += pFloat(row.gmv);
                p.orders += pInt(row.orders);
                p.items_sold += pInt(row.items_sold);
                p.video_gmv += pFloat(row.video_gmv);
                p.live_gmv += pFloat(row.live_gmv);
                p.shop_tab_gmv += pFloat(row.shop_tab_gmv);
            });

            let products = [...productMap.values()];

            // Apply search filter
            if (search) {
                products = products.filter(p => p.product_name?.toLowerCase().includes(search));
            }

            // Sort by GMV
            products.sort((a, b) => b.gmv - a.gmv);
            
            // Cache for export
            productsCache.filtered = products;

            // Aggregate prior period for trends
            const priorProductMap = new Map();
            priorData.forEach(row => {
                const key = `${row.product_id}|||${row.brand}`;
                if (!priorProductMap.has(key)) {
                    priorProductMap.set(key, { gmv: 0, orders: 0, items_sold: 0 });
                }
                const p = priorProductMap.get(key);
                p.gmv += pFloat(row.gmv);
                p.orders += pInt(row.orders);
                p.items_sold += pInt(row.items_sold);
            });
            const priorProducts = [...priorProductMap.values()];

            // Calculate current stats
            const totalGmv = products.reduce((s, p) => s + p.gmv, 0);
            const totalOrders = products.reduce((s, p) => s + p.orders, 0);
            const totalItems = products.reduce((s, p) => s + p.items_sold, 0);
            const totalVideoGmv = products.reduce((s, p) => s + p.video_gmv, 0);
            const totalLiveGmv = products.reduce((s, p) => s + p.live_gmv, 0);
            const totalShopGmv = products.reduce((s, p) => s + p.shop_tab_gmv, 0);

            // Calculate prior stats
            const priorGmv = priorProducts.reduce((s, p) => s + p.gmv, 0);
            const priorOrders = priorProducts.reduce((s, p) => s + p.orders, 0);
            const priorItems = priorProducts.reduce((s, p) => s + p.items_sold, 0);

            // Update stats with trends
            document.getElementById('productsStatGmv').textContent = fmtMoney(totalGmv);
            updateTrendIndicator('productsStatGmvChange', totalGmv, priorGmv);
            
            document.getElementById('productsStatTotal').textContent = products.length;
            updateTrendIndicator('productsStatTotalChange', products.length, priorProductMap.size);
            
            document.getElementById('productsStatOrders').textContent = fmt(totalOrders);
            updateTrendIndicator('productsStatOrdersChange', totalOrders, priorOrders);
            
            document.getElementById('productsStatItems').textContent = fmt(totalItems);
            updateTrendIndicator('productsStatItemsChange', totalItems, priorItems);
            
            document.getElementById('productsStatVideoGmv').textContent = fmtMoney(totalVideoGmv);
            document.getElementById('productsStatVideoPct').textContent = totalGmv > 0 ? `${(totalVideoGmv / totalGmv * 100).toFixed(0)}% of total` : '--% of total';
            document.getElementById('productsStatLiveGmv').textContent = fmtMoney(totalLiveGmv);
            document.getElementById('productsStatLivePct').textContent = totalGmv > 0 ? `${(totalLiveGmv / totalGmv * 100).toFixed(0)}% of total` : '--% of total';

            // Render insights
            renderProductInsights(products, totalVideoGmv, totalLiveGmv, totalShopGmv);

            // Update table count
            document.getElementById('productsTableCount').textContent = `${products.length} products`;

            // Paginate and render table
            const startIdx = (pages.products - 1) * PAGE_SIZE;
            const pageData = products.slice(startIdx, startIdx + PAGE_SIZE);

            document.getElementById('productsBody').innerHTML = pageData.map(p => `<tr>
                <td><div style="max-width:280px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:500;">${p.product_name || 'Unknown'}</div></td>
                <td><span class="badge-brand">${BRAND_DISPLAY[p.brand] || p.brand}</span></td>
                <td><span class="badge ${p.status === 'Active' ? 'badge-managed' : 'badge-unmanaged'}">${p.status || 'Unknown'}</span></td>
                <td><span class="gmv-value gmv-high">${fmtMoney(p.gmv)}</span></td>
                <td>${fmt(p.orders)}</td>
                <td>${fmt(p.items_sold)}</td>
                <td>${fmtMoney(p.video_gmv)}</td>
                <td>${fmtMoney(p.live_gmv)}</td>
                <td>${fmtMoney(p.shop_tab_gmv)}</td>
            </tr>`).join('') || '<tr><td colspan="9"><div class="empty-state"><h3>No products found</h3><p>Try adjusting your filters</p></div></td></tr>';

            renderPagination('productsPagination', products.length, pages.products, (p) => { pages.products = p; loadProductsData(); });
            } finally {
                hideLoading('products');
            }
        }

        function renderProductInsights(products, totalVideoGmv, totalLiveGmv, totalShopGmv) {
            // Top Products - top 5 by GMV
            const topProducts = products.slice(0, 5);
            document.getElementById('productsTopList').innerHTML = topProducts.length ? topProducts.map((p, i) => `
                <div class="leaderboard-item">
                    <div class="leaderboard-rank">${i + 1}</div>
                    <div class="leaderboard-info">
                        <div class="leaderboard-name" style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${p.product_name || 'Unknown'}</div>
                        <div class="leaderboard-brand">${BRAND_DISPLAY[p.brand] || p.brand}</div>
                    </div>
                    <div class="leaderboard-value">${fmtMoney(p.gmv)}</div>
                </div>
            `).join('') : '<div class="empty-state" style="padding: 20px;"><p>No products</p></div>';

            // Channel Breakdown Chart
            renderProductsChannelChart(totalVideoGmv, totalLiveGmv, totalShopGmv);
        }

        function renderProductsChannelChart(videoGmv, liveGmv, shopGmv) {
            const ctx = document.getElementById('productsChannelChart');
            if (!ctx) return;
            
            if (productsChannelChartInstance) {
                productsChannelChartInstance.destroy();
            }

            productsChannelChartInstance = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['Video', 'LIVE', 'Shop Tab'],
                    datasets: [{
                        data: [videoGmv, liveGmv, shopGmv],
                        backgroundColor: ['#f5c518', '#e74c3c', '#3498db'],
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
                                padding: 15,
                                usePointStyle: true,
                                font: { size: 12 }
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: (ctx) => {
                                    const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                                    const pct = total > 0 ? (ctx.raw / total * 100).toFixed(1) : 0;
                                    return `${ctx.label}: ${fmtMoney(ctx.raw)} (${pct}%)`;
                                }
                            }
                        }
                    },
                    cutout: '60%'
                }
            });
        }

        function exportProducts() {
            if (!productsCache.filtered.length) {
                showToast('No data to export', 'error');
                return;
            }
            
            const headers = ['Product', 'Brand', 'Status', 'GMV', 'Orders', 'Items Sold', 'Video GMV', 'LIVE GMV', 'Shop GMV'];
            const rows = productsCache.filtered.map(p => [
                p.product_name || 'Unknown',
                p.brand,
                p.status || 'Unknown',
                p.gmv.toFixed(2),
                p.orders,
                p.items_sold,
                p.video_gmv.toFixed(2),
                p.live_gmv.toFixed(2),
                p.shop_tab_gmv.toFixed(2)
            ]);
            
            const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `products-export-${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            showToast('Export complete!', 'success');
        }

        // Search input debounce for products
        let productsSearchTimeout;
        document.getElementById('productsSearchInput')?.addEventListener('input', () => {
            clearTimeout(productsSearchTimeout);
            productsSearchTimeout = setTimeout(() => {
                pages.products = 1;
                loadProductsData();
            }, 300);
        });

        // ==================== DAILY OPS ====================
        let spotlightCandidates = [];
        let currentSpotlightIndex = 0;
        let recentSpotlights = []; // Track recently spotlighted creators

        const TIER_THRESHOLDS = {
            ruby: 200000,
            diamond: 100000,
            platinum: 50000,
            gold: 20000,
            silver: 5000,
            bronze: 2000
        };

        const TIER_NAMES = {
            ruby: '💎 Ruby',
            diamond: '💠 Diamond',
            platinum: '🌟 Platinum',
            gold: '🥇 Gold',
            silver: '🥈 Silver',
            bronze: '🥉 Bronze',
            new: '🌱 New'
        };

        function getTierFromGMV(gmv) {
            if (gmv >= TIER_THRESHOLDS.ruby) return 'ruby';
            if (gmv >= TIER_THRESHOLDS.diamond) return 'diamond';
            if (gmv >= TIER_THRESHOLDS.platinum) return 'platinum';
            if (gmv >= TIER_THRESHOLDS.gold) return 'gold';
            if (gmv >= TIER_THRESHOLDS.silver) return 'silver';
            if (gmv >= TIER_THRESHOLDS.bronze) return 'bronze';
            return 'new';
        }

        function copyToClipboard(elementId) {
            const el = document.getElementById(elementId);
            const text = el.innerText || el.textContent;
            navigator.clipboard.writeText(text).then(() => {
                // Show feedback
                const btn = el.closest('.card').querySelector('.btn');
                const originalText = btn.textContent;
                btn.textContent = '✅ Copied!';
                btn.style.background = 'var(--success)';
                btn.style.color = '#000';
                setTimeout(() => {
                    btn.textContent = originalText;
                    btn.style.background = '';
                    btn.style.color = '';
                }, 2000);
            });
        }
        
        // Generic copy function with visual feedback
        function copyText(text, buttonEl = null) {
            navigator.clipboard.writeText(text).then(() => {
                showToast('Copied to clipboard!', 'success', 2000);
                if (buttonEl) {
                    buttonEl.classList.add('copied');
                    setTimeout(() => buttonEl.classList.remove('copied'), 1500);
                }
            }).catch(() => {
                showToast('Failed to copy', 'error');
            });
        }
        
        // Animate number changes
        function animateValue(element, start, end, duration = 500) {
            const startTime = performance.now();
            const isFloat = end % 1 !== 0;
            
            function update(currentTime) {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const easeProgress = 1 - Math.pow(1 - progress, 3); // easeOutCubic
                const current = start + (end - start) * easeProgress;
                
                if (isFloat) {
                    element.textContent = current.toFixed(2);
                } else {
                    element.textContent = Math.round(current).toLocaleString();
                }
                
                if (progress < 1) {
                    requestAnimationFrame(update);
                } else {
                    element.classList.add('updated');
                    setTimeout(() => element.classList.remove('updated'), 400);
                }
            }
            
            requestAnimationFrame(update);
        }

        async function loadDailyOps() {
            showLoading('dailyops', 'Loading daily performance...');
            try {
            const today = new Date();
            
            // Get selected date from picker
            const datePickerEl = document.getElementById('dailyDatePicker');
            let selectedDateStr;
            
            // Try to get date from Litepicker instance
            const picker = datePickers['dailyDatePicker'];
            if (picker && picker.getDate()) {
                const pickerDate = picker.getDate();
                selectedDateStr = pickerDate.format('YYYY-MM-DD');
            } else if (datePickerEl && datePickerEl.value) {
                // Parse display format "Nov 24, 2025" or use as-is if already YYYY-MM-DD
                const val = datePickerEl.value;
                if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
                    selectedDateStr = val;
                } else {
                    // Try to parse display format
                    const parsed = new Date(val);
                    if (!isNaN(parsed.getTime())) {
                        selectedDateStr = parsed.toISOString().split('T')[0];
                    }
                }
            }
            
            // Default to most recent date with data (smart default)
            if (!selectedDateStr || selectedDateStr === 'Invalid Date' || selectedDateStr === 'undefined') {
                // Use most recent available date, fall back to yesterday
                if (availableDates.daily && availableDates.daily.length > 0) {
                    selectedDateStr = availableDates.daily[0]; // Most recent date with data
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
                        selectedDateStr = latestDate.report_date;
                    } else {
                        const yesterday = new Date(today);
                        yesterday.setDate(yesterday.getDate() - 1);
                        selectedDateStr = yesterday.toISOString().split('T')[0];
                    }
                }
            }

            const brandFilter = document.getElementById('dailyBrandFilter').value;
            const brandLabel = brandFilter === 'all' ? 'All Brands' : (BRAND_DISPLAY[brandFilter] || brandFilter);

            // Format date nicely
            const displayDate = formatDate(selectedDateStr);
            document.getElementById('dailyOpsDate').textContent = 
                `${displayDate} • ${brandLabel} • Generated: ${today.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;

            // Check if data is stale (not from yesterday)
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];
            const selectedDate = new Date(selectedDateStr + 'T12:00:00');
            const daysDiff = Math.floor((yesterday - selectedDate) / (1000 * 60 * 60 * 24));
            
            // Fetch per-brand data health
            const { data: brandHealth } = await supabaseClient
                .from('creator_performance')
                .select('brand, report_date')
                .eq('period_type', 'daily')
                .gte('report_date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
                .order('report_date', { ascending: false });
            
            // Calculate last upload date per brand
            const allBrands = ['catakor', 'jiyu', 'physicians_choice', 'peach_slices', 'yerba_magic'];
            const brandLastUpload = {};
            allBrands.forEach(b => brandLastUpload[b] = null);
            
            (brandHealth || []).forEach(row => {
                if (!brandLastUpload[row.brand] || row.report_date > brandLastUpload[row.brand]) {
                    brandLastUpload[row.brand] = row.report_date;
                }
            });
            
            // Show/hide stale data warning
            let staleWarning = document.getElementById('dailyStaleWarning');
            if (!staleWarning) {
                // Create warning element if it doesn't exist
                staleWarning = document.createElement('div');
                staleWarning.id = 'dailyStaleWarning';
                staleWarning.style.cssText = 'background: var(--warning-dim); border: 1px solid var(--warning); border-radius: 8px; padding: 12px 16px; margin-bottom: 16px;';
                const dailyContent = document.getElementById('dailyContent');
                if (dailyContent) {
                    dailyContent.insertBefore(staleWarning, dailyContent.firstChild);
                }
            }
            
            // Build brand status HTML
            const brandStatusHTML = allBrands.map(brand => {
                const lastDate = brandLastUpload[brand];
                const brandName = BRAND_DISPLAY[brand] || brand;
                if (!lastDate) {
                    return `<span style="display: inline-flex; align-items: center; gap: 4px; margin-right: 12px;"><span style="color: var(--danger);">❌</span> ${brandName}: No data</span>`;
                }
                const brandDaysDiff = Math.floor((yesterday - new Date(lastDate + 'T12:00:00')) / (1000 * 60 * 60 * 24));
                if (brandDaysDiff <= 0) {
                    return `<span style="display: inline-flex; align-items: center; gap: 4px; margin-right: 12px;"><span style="color: var(--success);">✅</span> ${brandName}</span>`;
                } else if (brandDaysDiff <= 2) {
                    return `<span style="display: inline-flex; align-items: center; gap: 4px; margin-right: 12px;"><span style="color: var(--warning);">⚠️</span> ${brandName}: ${brandDaysDiff}d old</span>`;
                } else {
                    return `<span style="display: inline-flex; align-items: center; gap: 4px; margin-right: 12px;"><span style="color: var(--danger);">❌</span> ${brandName}: ${brandDaysDiff}d old</span>`;
                }
            }).join('');
            
            // Count brands with issues
            const brandsWithIssues = allBrands.filter(b => {
                const lastDate = brandLastUpload[b];
                if (!lastDate) return true;
                const brandDaysDiff = Math.floor((yesterday - new Date(lastDate + 'T12:00:00')) / (1000 * 60 * 60 * 24));
                return brandDaysDiff > 0;
            }).length;
            
            if (daysDiff > 0 || brandsWithIssues > 0) {
                staleWarning.innerHTML = `
                    <div style="display: flex; align-items: flex-start; gap: 10px;">
                        <span style="font-size: 1.3rem;">⚠️</span>
                        <div style="flex: 1;">
                            <strong style="color: var(--warning);">Data Health Check</strong>
                            ${daysDiff > 0 ? `<div style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 4px;">Showing ${displayDate} — ${daysDiff} day${daysDiff > 1 ? 's' : ''} behind. New data uploads needed.</div>` : ''}
                            <div style="margin-top: 8px; font-size: 0.85rem; display: flex; flex-wrap: wrap;">${brandStatusHTML}</div>
                        </div>
                    </div>
                `;
                staleWarning.style.display = 'block';
            } else {
                staleWarning.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 1.3rem;">✅</span>
                        <div>
                            <strong style="color: var(--success);">All Data Current</strong>
                            <div style="margin-top: 4px; font-size: 0.85rem; display: flex; flex-wrap: wrap;">${brandStatusHTML}</div>
                        </div>
                    </div>
                `;
                staleWarning.style.display = 'block';
                staleWarning.style.background = 'var(--success-dim)';
                staleWarning.style.borderColor = 'var(--success)';
            }

            // Use RPC function for aggregated data (bypasses row limits)
            let dailyData = null;
            const { data: rpcData, error: rpcError } = await supabaseClient.rpc('get_daily_ops_data', {
                p_brand: brandFilter === 'all' ? null : brandFilter,
                p_date: selectedDateStr
            }).limit(50000);

            if (rpcError) {
                console.warn('RPC not available, using fallback query:', rpcError.message);
                // Fallback: direct query
                let query = supabaseClient
                    .from('creator_performance')
                    .select('creator_name, brand, gmv, orders, videos, refunds, est_commission')
                    .eq('report_date', selectedDateStr)
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
                dailyData = fallbackData;
            } else {
                dailyData = rpcData;
            }

            // Check for no data
            const noDataWarning = document.getElementById('dailyNoDataWarning');
            const dailyContent = document.getElementById('dailyContent');

            if (!dailyData || dailyData.length === 0) {
                noDataWarning.style.display = 'flex';
                dailyContent.style.display = 'none';
                document.getElementById('dailyProgressHero').style.display = 'none';
                return;
            } else {
                noDataWarning.style.display = 'none';
                dailyContent.style.display = 'block';
                document.getElementById('dailyProgressHero').style.display = 'block';
            }

            // Process the data
            const creators = dailyData.map(row => ({
                name: row.creator_name,
                brand: row.brand,
                gmv: pFloat(row.gmv),
                orders: pInt(row.orders),
                videos: pInt(row.videos),
                refunds: pFloat(row.refunds),
                commission: pFloat(row.est_commission),
                priorGmv: pFloat(row.prior_day_gmv),
                priorOrders: pInt(row.prior_day_orders),
                priorVideos: pInt(row.prior_day_videos),
                gmvChange: pFloat(row.prior_day_gmv) > 0 
                    ? ((pFloat(row.gmv) - pFloat(row.prior_day_gmv)) / pFloat(row.prior_day_gmv) * 100) 
                    : (pFloat(row.gmv) > 0 ? 100 : 0)
            }));

            // Calculate totals by brand
            const brandTotals = {};
            let totalGmv = 0, totalOrders = 0, totalVideos = 0, totalPriorGmv = 0;
            
            creators.forEach(c => {
                if (!brandTotals[c.brand]) {
                    brandTotals[c.brand] = { gmv: 0, orders: 0, videos: 0, creators: 0, priorGmv: 0 };
                }
                brandTotals[c.brand].gmv += c.gmv;
                brandTotals[c.brand].orders += c.orders;
                brandTotals[c.brand].videos += c.videos;
                brandTotals[c.brand].creators++;
                brandTotals[c.brand].priorGmv += c.priorGmv;
                
                totalGmv += c.gmv;
                totalOrders += c.orders;
                totalVideos += c.videos;
                totalPriorGmv += c.priorGmv;
            });

            // Detect wins and attention
            const wins = detectDailyWinsFromData(creators);
            const attention = detectDailyAttentionFromData(creators);

            // Store for brand action board
            window.dailyCreators = creators;
            window.dailyBrandTotals = brandTotals;
            window.dailyWins = wins;
            window.dailyAttention = attention;

            // Update snapshot stats
            const gmvChange = totalPriorGmv > 0 ? ((totalGmv - totalPriorGmv) / totalPriorGmv * 100) : 0;
            document.getElementById('dailyTotalGmv').textContent = fmtMoney(totalGmv);
            document.getElementById('dailyTotalOrders').textContent = fmt(totalOrders);
            document.getElementById('dailyTotalVideos').textContent = fmt(totalVideos);
            document.getElementById('dailyActiveCreators').textContent = fmt(creators.length);
            document.getElementById('dailyWinsCount').textContent = fmt(wins.length);
            
            const gmvChangeEl = document.getElementById('dailyGmvChange');
            if (gmvChange !== 0) {
                gmvChangeEl.textContent = `${gmvChange >= 0 ? '↑' : '↓'} ${Math.abs(gmvChange).toFixed(1)}% vs prior`;
                gmvChangeEl.className = `snapshot-change ${gmvChange >= 0 ? 'positive' : 'negative'}`;
            } else {
                gmvChangeEl.textContent = '--';
            }

            // Generate copyable summary
            generateDailySummary(creators, brandTotals, wins, attention, selectedDateStr, brandLabel);

            // Build brand action board
            buildDailyBrandActionBoard(creators, wins, attention, brandTotals);

            // Populate wins hero section
            renderDailyWinsHero(wins);

            // Update wins count badge
            document.getElementById('winsCount').textContent = wins.length;

            // Populate spotlight candidates from daily data
            populateSpotlightFromDaily(creators);
            } finally {
                hideLoading('dailyops');
            }
        }

        function populateSpotlightFromDaily(creators) {
            // Create spotlight candidates from MANAGED creators with good performance
            // but not in the top wins (those are already being celebrated)
            const topWinNames = new Set((window.dailyWins || []).slice(0, 10).map(w => w.name));
            
            spotlightCandidates = creators
                .filter(c => 
                    isManagedForBrand(c.name, c.brand) && // Only managed creators
                    c.gmv >= 50 && c.gmv < 500 && // Mid-tier performers
                    !topWinNames.has(c.name)
                )
                .map(c => ({
                    name: c.name,
                    brand: c.brand,
                    gmv: c.gmv,
                    orders: c.orders,
                    videos: c.videos,
                    daysActive: 1, // Single day context
                    avgGMVPerDay: c.gmv,
                    conversionRate: c.videos > 0 ? c.orders / c.videos : 0,
                    score: c.gmv + (c.videos * 50) // Simple scoring
                }))
                .sort((a, b) => b.score - a.score)
                .slice(0, 20); // Keep top 20 candidates

            // Also populate by brand for brand detail view
            window.dailyBrandSpotlights = {};
            spotlightCandidates.forEach(c => {
                if (!window.dailyBrandSpotlights[c.brand]) {
                    window.dailyBrandSpotlights[c.brand] = [];
                }
                if (window.dailyBrandSpotlights[c.brand].length < 3) {
                    window.dailyBrandSpotlights[c.brand].push({
                        name: c.name,
                        gmv: c.gmv,
                        videos: c.videos,
                        daysActive: 1,
                        reason: c.videos >= 2 ? `Posted ${c.videos} videos today` : `Generated ${fmtMoney(c.gmv)} GMV`,
                        shoutout: `CREATOR SHOUTOUT 📣\n\nGiving @${c.name} 😎 a shout-out!\n\nKeep up the great work! 🙌`
                    });
                }
            });

            currentSpotlightIndex = 0;
            renderSpotlight();
        }

        function detectDailyWinsFromData(creators) {
            const wins = [];
            
            creators.forEach(c => {
                // Only include managed creators
                if (!isManagedForBrand(c.name, c.brand)) return;
                
                const reasons = [];
                
                // Big GMV day ($500+)
                if (c.gmv >= 500) {
                    reasons.push({ type: 'big_day', msg: `💰 ${fmtMoney(c.gmv)} GMV day!` });
                }
                
                // Huge growth (50%+ increase with meaningful volume)
                if (c.gmvChange >= 50 && c.gmv >= 100 && c.priorGmv >= 50) {
                    reasons.push({ type: 'growth', msg: `📈 +${c.gmvChange.toFixed(0)}% growth` });
                }
                
                // High video output (3+ videos)
                if (c.videos >= 3) {
                    reasons.push({ type: 'content', msg: `🎬 ${c.videos} videos posted` });
                }
                
                // First sale (new creator)
                if (c.gmv > 0 && c.priorGmv === 0 && c.priorOrders === 0) {
                    reasons.push({ type: 'first_sale', msg: `🌟 First tracked sale!` });
                }

                if (reasons.length > 0) {
                    wins.push({ ...c, reasons });
                }
            });

            // Sort by GMV
            wins.sort((a, b) => b.gmv - a.gmv);
            return wins;
        }

        function detectDailyAttentionFromData(creators) {
            const attention = [];
            
            creators.forEach(c => {
                // Only include managed creators
                if (!isManagedForBrand(c.name, c.brand)) return;
                
                const issues = [];
                
                // Big GMV drop (30%+ decline with previous meaningful volume)
                if (c.priorGmv >= 100 && c.gmv < c.priorGmv * 0.7) {
                    const dropPct = ((c.priorGmv - c.gmv) / c.priorGmv * 100).toFixed(0);
                    issues.push({ type: 'gmv_drop', severity: 2, msg: `📉 GMV down ${dropPct}%` });
                }
                
                // Was active, now no sales
                if (c.priorGmv >= 50 && c.gmv === 0) {
                    issues.push({ type: 'no_sales', severity: 3, msg: `⚠️ No sales today (had ${fmtMoney(c.priorGmv)} yesterday)` });
                }
                
                // Stopped posting (had videos, now none)
                if (c.priorVideos >= 1 && c.videos === 0 && c.priorGmv >= 100) {
                    issues.push({ type: 'no_content', severity: 2, msg: `📭 No videos (had ${c.priorVideos} yesterday)` });
                }

                if (issues.length > 0) {
                    issues.sort((a, b) => b.severity - a.severity);
                    attention.push({ ...c, issues });
                }
            });

            // Sort by severity then GMV impact
            attention.sort((a, b) => {
                const severityA = Math.max(...a.issues.map(i => i.severity));
                const severityB = Math.max(...b.issues.map(i => i.severity));
                if (severityB !== severityA) return severityB - severityA;
                return b.priorGmv - a.priorGmv;
            });
            
            return attention;
        }

        function generateDailySummary(creators, brandTotals, wins, attention, dateStr, brandLabel) {
            const totalGmv = creators.reduce((s, c) => s + c.gmv, 0);
            const totalOrders = creators.reduce((s, c) => s + c.orders, 0);
            const totalVideos = creators.reduce((s, c) => s + c.videos, 0);
            const priorTotalGmv = creators.reduce((s, c) => s + c.priorGmv, 0);
            const gmvChange = priorTotalGmv > 0 ? ((totalGmv - priorTotalGmv) / priorTotalGmv * 100) : 0;
            const activeCreators = creators.filter(c => c.gmv > 0).length;

            const emoji = gmvChange >= 10 ? '🚀' : gmvChange >= 0 ? '✅' : gmvChange >= -10 ? '📊' : '⚠️';
            
            // Build summary
            let summary = `☀️ DAILY OPS - ${formatDate(dateStr)}
${brandLabel}

${emoji} OVERALL HEALTH
━━━━━━━━━━━━━━━━━━━━
💰 GMV: ${fmtMoney(totalGmv)} (${gmvChange >= 0 ? '+' : ''}${gmvChange.toFixed(1)}% DoD)
📦 Orders: ${fmt(totalOrders)}
🎬 Videos: ${fmt(totalVideos)}
👥 Active Creators: ${activeCreators}

`;

            // Brand breakdown
            if (Object.keys(brandTotals).length > 1) {
                summary += `📊 BY BRAND\n━━━━━━━━━━━━━━━━━━━━\n`;
                Object.entries(brandTotals)
                    .sort((a, b) => b[1].gmv - a[1].gmv)
                    .forEach(([brand, data]) => {
                        const change = data.priorGmv > 0 ? ((data.gmv - data.priorGmv) / data.priorGmv * 100) : 0;
                        const icon = change >= 10 ? '🟢' : change >= -10 ? '🟡' : '🔴';
                        summary += `${icon} ${BRAND_DISPLAY[brand]}: ${fmtMoney(data.gmv)} (${change >= 0 ? '+' : ''}${change.toFixed(0)}%)\n`;
                    });
                summary += '\n';
            }

            // Top wins
            if (wins.length > 0) {
                summary += `🏆 TOP WINS (${wins.length} total)\n━━━━━━━━━━━━━━━━━━━━\n`;
                wins.slice(0, 5).forEach((w, i) => {
                    summary += `${i + 1}. ${w.name} (${BRAND_DISPLAY[w.brand]}): ${fmtMoney(w.gmv)} - ${w.reasons[0].msg}\n`;
                });
                summary += '\n';
            }

            // Attention needed
            if (attention.length > 0) {
                summary += `⚠️ NEEDS ATTENTION (${attention.length} creators)\n━━━━━━━━━━━━━━━━━━━━\n`;
                attention.slice(0, 5).forEach((a, i) => {
                    summary += `${i + 1}. ${a.name} (${BRAND_DISPLAY[a.brand]}): ${a.issues[0].msg}\n`;
                });
            }

            document.getElementById('morningMattContent').textContent = summary;
        }

        function buildDailyBrandActionBoard(creators, wins, attention, brandTotals) {
            const allBrands = ['catakor', 'jiyu', 'physicians_choice', 'peach_slices', 'yerba_magic'];
            const container = document.getElementById('brandActionBoard');
            
            // Debug: log what brands we actually have
            console.log('Brand totals keys:', Object.keys(brandTotals));
            console.log('Brand totals:', brandTotals);
            
            // Group wins and attention by brand
            const winsByBrand = {};
            const attentionByBrand = {};
            
            allBrands.forEach(brand => {
                winsByBrand[brand] = wins.filter(w => w.brand === brand);
                attentionByBrand[brand] = attention.filter(a => a.brand === brand);
            });

            // Also check for brand keys that might be different format
            Object.keys(brandTotals).forEach(key => {
                if (!allBrands.includes(key)) {
                    console.log('Found unexpected brand key:', key);
                    winsByBrand[key] = wins.filter(w => w.brand === key);
                    attentionByBrand[key] = attention.filter(a => a.brand === key);
                }
            });

            // Store globally for detail view
            window.dailyWinsByBrand = winsByBrand;
            window.dailyAttentionByBrand = attentionByBrand;

            // Use actual brand keys from data, falling back to allBrands
            const brandsToShow = Object.keys(brandTotals).length > 0 ? Object.keys(brandTotals) : allBrands;

            // Build brand cards
            let totalActions = 0;
            container.innerHTML = brandsToShow.map(brand => {
                const data = brandTotals[brand] || { gmv: 0, orders: 0, videos: 0, creators: 0, priorGmv: 0 };
                const brandWins = winsByBrand[brand] || wins.filter(w => w.brand === brand);
                const brandAttention = attentionByBrand[brand] || attention.filter(a => a.brand === brand);
                const actions = brandWins.length + brandAttention.length;
                totalActions += actions;
                
                const change = data.priorGmv > 0 ? ((data.gmv - data.priorGmv) / data.priorGmv * 100) : 0;
                const healthClass = change >= 10 ? 'health-great' : change >= -10 ? 'health-ok' : 'health-bad';
                const isComplete = window.completedDailyBrands?.has(brand);
                const displayName = BRAND_DISPLAY[brand] || brand;
                
                return `
                    <div class="brand-action-card ${healthClass} ${isComplete ? 'completed' : ''}" onclick="showDailyBrandDetail('${brand}')">
                        <div class="brand-card-header">
                            <span class="brand-name">${displayName}</span>
                            ${isComplete ? '<span class="complete-badge">✅</span>' : ''}
                        </div>
                        <div class="brand-card-stats">
                            <div class="stat">${fmtMoney(data.gmv)}</div>
                            <div class="stat-change ${change >= 0 ? 'positive' : 'negative'}">${change >= 0 ? '+' : ''}${change.toFixed(0)}%</div>
                        </div>
                        <div class="brand-card-actions">
                            ${brandWins.length > 0 ? `<span class="action-badge wins">🏆 ${brandWins.length}</span>` : ''}
                            ${brandAttention.length > 0 ? `<span class="action-badge attention">⚠️ ${brandAttention.length}</span>` : ''}
                            ${actions === 0 ? '<span class="action-badge neutral">✓ All good</span>' : ''}
                        </div>
                    </div>
                `;
            }).join('');

            document.getElementById('totalActionsCount').textContent = `${totalActions} actions`;

            // Build progress brands (new hero UI)
            const progressBrands = document.getElementById('dailyProgressBrands');
            if (progressBrands) {
                progressBrands.innerHTML = brandsToShow.map(brand => {
                    const isComplete = window.completedDailyBrands?.has(brand);
                    const data = brandTotals[brand] || { gmv: 0 };
                    const displayName = BRAND_DISPLAY[brand] || brand;
                    return `
                        <label class="brand-check ${isComplete ? 'completed' : ''}">
                            <input type="checkbox" ${isComplete ? 'checked' : ''} onchange="toggleDailyBrandComplete('${brand}', this.checked)">
                            <span>${displayName}</span>
                            <span style="margin-left: auto; font-weight: 600;">${fmtMoney(data.gmv)}</span>
                        </label>
                    `;
                }).join('');
            }

            updateDailyProgress();
        }

        function showDailyBrandDetail(brand) {
            const brandTotals = window.dailyBrandTotals || {};
            const data = brandTotals[brand] || { gmv: 0, orders: 0, videos: 0, creators: 0 };
            const brandWins = window.dailyWinsByBrand?.[brand] || [];
            const brandAttention = window.dailyAttentionByBrand?.[brand] || [];

            window.currentDailyBrand = brand;

            // Update header
            document.getElementById('brandDetailName').textContent = BRAND_DISPLAY[brand];
            
            // Update stats
            document.getElementById('brandDetailGmv').textContent = fmtMoney(data.gmv);
            document.getElementById('brandDetailOrders').textContent = fmt(data.orders);
            document.getElementById('brandDetailVideos').textContent = fmt(data.videos);
            document.getElementById('brandDetailCreators').textContent = fmt(data.creators);

            // Wins
            document.getElementById('brandWinsCount').textContent = brandWins.length;
            document.getElementById('brandWinsContainer').innerHTML = brandWins.length > 0 
                ? brandWins.map(w => `
                    <div class="action-item win">
                        <div class="action-header">
                            <strong>${w.name}</strong>
                            <span class="gmv">${fmtMoney(w.gmv)}</span>
                        </div>
                        <div class="action-reasons">${w.reasons.map(r => r.msg).join(' • ')}</div>
                        <div class="action-buttons">
                            <button class="btn btn-tiny" onclick="copyWinMessage('${w.name}', '${brand}', ${w.gmv})">📋 Copy Shoutout</button>
                        </div>
                    </div>
                `).join('')
                : '<p class="empty-message">No wins to celebrate today</p>';

            // Attention
            document.getElementById('brandAttentionCount').textContent = brandAttention.length;
            document.getElementById('brandAttentionContainer').innerHTML = brandAttention.length > 0 
                ? brandAttention.map(a => `
                    <div class="action-item attention">
                        <div class="action-header">
                            <strong>${a.name}</strong>
                            <span class="prior-gmv">Was: ${fmtMoney(a.priorGmv)}</span>
                        </div>
                        <div class="action-issues">${a.issues.map(i => i.msg).join(' • ')}</div>
                        <div class="action-buttons">
                            <button class="btn btn-tiny" onclick="copyFollowupMessage('${a.name}', '${brand}')">📋 Copy DM</button>
                        </div>
                    </div>
                `).join('')
                : '<p class="empty-message">No creators need attention</p>';

            // Spotlight (pick a random mid-tier creator)
            const midTierCreators = (window.dailyCreators || [])
                .filter(c => c.brand === brand && c.gmv >= 50 && c.gmv <= 300 && c.videos >= 1);
            const spotlight = midTierCreators[Math.floor(Math.random() * midTierCreators.length)];
            document.getElementById('brandSpotlightContainer').innerHTML = spotlight
                ? `<div class="spotlight-card">
                    <strong>${spotlight.name}</strong> - ${fmtMoney(spotlight.gmv)} with ${spotlight.videos} video(s)
                    <button class="btn btn-tiny" onclick="copySpotlightMessage('${spotlight.name}', '${brand}')">📋 Copy</button>
                   </div>`
                : '<p class="empty-message">No spotlight suggestions</p>';

            // Show detail, hide board
            document.getElementById('brandDailyDetail').style.display = 'block';
            document.getElementById('brandActionBoard').parentElement.parentElement.style.display = 'none';
        }

        function closeBrandDetail() {
            document.getElementById('brandDailyDetail').style.display = 'none';
            document.getElementById('brandActionBoard').parentElement.parentElement.style.display = 'block';
        }

        function markBrandComplete() {
            if (window.currentDailyBrand) {
                toggleDailyBrandComplete(window.currentDailyBrand, true);
                closeBrandDetail();
            }
        }

        function renderDailyWinsHero(wins) {
            console.log('Rendering wins:', wins?.length || 0);
            
            try {
                document.getElementById('winsCount').textContent = wins?.length || 0;
                
                if (!wins || wins.length === 0) {
                    document.getElementById('dailyWinsContainer').innerHTML = `
                        <div class="empty-state" style="padding: 40px;">
                            <div class="icon">🏆</div>
                            <h3>No wins detected yet</h3>
                            <p>Wins are triggered by $500+ GMV days, 50%+ growth, 3+ videos posted, or first sales</p>
                        </div>
                    `;
                    return;
                }

                // Limit to first 50 for performance
                const winsToShow = wins.slice(0, 50);
                
                document.getElementById('dailyWinsContainer').innerHTML = winsToShow.map((w, i) => {
                    const safeName = (w.name || 'Unknown').replace(/'/g, "\\'").replace(/"/g, '\\"');
                    const brandDisplay = BRAND_DISPLAY[w.brand] || w.brand || 'Unknown';
                    const reasons = w.reasons?.map(r => r.msg).join(' • ') || '';
                    
                    return `
                        <div class="win-item" id="win-${i}">
                            <div class="win-info">
                                <div class="win-creator">@${w.name || 'Unknown'}</div>
                                <div class="win-details">
                                    <span class="badge-brand" style="font-size: 0.7rem;">${brandDisplay}</span>
                                    <span style="margin-left: 8px;">${reasons}</span>
                                </div>
                            </div>
                            <div class="win-gmv">${fmtMoney(w.gmv || 0)}</div>
                            <div class="win-actions">
                                <button class="btn btn-small" onclick="copyWinByIndex(${i})">📋 Copy</button>
                            </div>
                        </div>
                    `;
                }).join('');
                
                if (wins.length > 50) {
                    document.getElementById('dailyWinsContainer').innerHTML += `
                        <div style="text-align: center; padding: 16px; color: var(--text-muted);">
                            Showing 50 of ${wins.length} wins
                        </div>
                    `;
                }
            } catch (error) {
                console.error('Error rendering wins:', error);
                document.getElementById('dailyWinsContainer').innerHTML = `
                    <div class="empty-state" style="padding: 40px;">
                        <div class="icon">⚠️</div>
                        <h3>Error loading wins</h3>
                        <p>${error.message}</p>
                    </div>
                `;
            }
        }

        function copyWinByIndex(index) {
            const wins = window.dailyWins || [];
            const w = wins[index];
            if (!w) return;
            
            const msg = `🏆 SHOUTOUT to @${w.name}!\n\nCrushed it with ${fmtMoney(w.gmv)} in sales! 💰🔥\n\nKeep that energy going! 🚀`;
            navigator.clipboard.writeText(msg);
            
            // Visual feedback
            const el = document.getElementById(`win-${index}`);
            if (el) {
                el.classList.add('copied');
                setTimeout(() => el.classList.remove('copied'), 2000);
            }
            showToast('Shoutout copied!', 'success');
        }

        function copyAllWins() {
            const wins = window.dailyWins || [];
            if (wins.length === 0) {
                showToast('No wins to copy', 'error');
                return;
            }
            
            const messages = wins.map(w => 
                `🏆 @${w.name} - ${fmtMoney(w.gmv)} (${BRAND_DISPLAY[w.brand]})`
            ).join('\n');
            
            const header = `🎉 TODAY'S WINS (${wins.length})\n${'─'.repeat(30)}\n`;
            navigator.clipboard.writeText(header + messages);
            showToast(`${wins.length} wins copied!`, 'success');
        }

        // Keep old function for compatibility
        function renderDailyWins(wins) {
            renderDailyWinsHero(wins);
        }

        function copyWinMessage(name, brand, gmv) {
            const msg = `🏆 SHOUTOUT to @${name}! 

Crushed it with ${fmtMoney(gmv)} in sales! 💰🔥

Keep that energy going! 🚀`;
            navigator.clipboard.writeText(msg);
            showToast('Win message copied!');
        }

        function copyFollowupMessage(name, brand) {
            const msg = `Hey @${name}! 👋

Just checking in - noticed things were a bit quiet yesterday. Everything good?

Let me know if you need any support with content ideas or product selection. We're here to help! 💪`;
            navigator.clipboard.writeText(msg);
            showToast('Follow-up message copied!');
        }

        function copySpotlightMessage(name, brand) {
            const msg = `📣 Creator Spotlight: @${name}

Consistent work pays off! Keep posting and engaging - you're building something great! 🌟`;
            navigator.clipboard.writeText(msg);
            showToast('Spotlight message copied!');
        }

        // Brand action board state
        window.dailyBrandData = {};
        window.dailyBrandWins = {};
        window.dailyBrandAttention = {};
        window.dailyBrandSpotlights = {};
        window.dailyBrandDoD = {}; // Day-over-day changes
        window.completedDailyBrands = new Set();
        window.currentDailyBrand = null;

        window.weeklyBrandWinners = {};
        window.weeklyBrandAttention = {};
        window.completedWeeklyBrands = new Set();
        window.currentWeeklyBrand = null;

        // localStorage persistence for completed brands
        function loadCompletedBrands() {
            const today = localDateStr(new Date());
            const weekStart = getWeekStart();
            
            // Daily - reset if different day
            const dailyData = JSON.parse(localStorage.getItem('completedDailyBrands') || '{}');
            if (dailyData.date === today) {
                window.completedDailyBrands = new Set(dailyData.brands || []);
            } else {
                window.completedDailyBrands = new Set();
                localStorage.setItem('completedDailyBrands', JSON.stringify({ date: today, brands: [] }));
            }
            
            // Weekly - reset if different week
            const weeklyData = JSON.parse(localStorage.getItem('completedWeeklyBrands') || '{}');
            if (weeklyData.weekStart === weekStart) {
                window.completedWeeklyBrands = new Set(weeklyData.brands || []);
            } else {
                window.completedWeeklyBrands = new Set();
                localStorage.setItem('completedWeeklyBrands', JSON.stringify({ weekStart, brands: [] }));
            }
        }

        function getWeekStart() {
            const now = new Date();
            const day = now.getDay();
            const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
            const monday = new Date(now);
            monday.setDate(diff);
            return localDateStr(monday);
        }

        function saveCompletedDailyBrands() {
            const today = localDateStr(new Date());
            localStorage.setItem('completedDailyBrands', JSON.stringify({
                date: today,
                brands: Array.from(window.completedDailyBrands)
            }));
        }

        function saveCompletedWeeklyBrands() {
            const weekStart = getWeekStart();
            localStorage.setItem('completedWeeklyBrands', JSON.stringify({
                weekStart,
                brands: Array.from(window.completedWeeklyBrands)
            }));
        }

        // Load on startup
        loadCompletedBrands();

        function toggleDailyBrandComplete(brandKey, checked) {
            if (checked === undefined) {
                // Toggle mode
                if (window.completedDailyBrands.has(brandKey)) {
                    window.completedDailyBrands.delete(brandKey);
                } else {
                    window.completedDailyBrands.add(brandKey);
                }
            } else {
                // Explicit set mode
                if (checked) {
                    window.completedDailyBrands.add(brandKey);
                } else {
                    window.completedDailyBrands.delete(brandKey);
                }
            }
            saveCompletedDailyBrands();
            
            // Update UI without full rebuild
            updateDailyProgress();
            
            // Update brand card styling
            document.querySelectorAll('.brand-action-card').forEach(card => {
                const brand = card.getAttribute('onclick')?.match(/'([^']+)'/)?.[1];
                if (brand === brandKey) {
                    card.classList.toggle('completed', window.completedDailyBrands.has(brandKey));
                    const badge = card.querySelector('.complete-badge');
                    if (window.completedDailyBrands.has(brandKey) && !badge) {
                        card.querySelector('.brand-card-header').insertAdjacentHTML('beforeend', '<span class="complete-badge">✅</span>');
                    } else if (!window.completedDailyBrands.has(brandKey) && badge) {
                        badge.remove();
                    }
                }
            });
            
            // Update progress brand checks
            document.querySelectorAll('.brand-check').forEach(check => {
                const input = check.querySelector('input');
                if (check.textContent.includes(BRAND_DISPLAY[brandKey])) {
                    check.classList.toggle('completed', window.completedDailyBrands.has(brandKey));
                    if (input) input.checked = window.completedDailyBrands.has(brandKey);
                }
            });
        }

        function updateDailyProgress() {
            const total = 5;
            const completed = window.completedDailyBrands?.size || 0;
            const percentage = (completed / total) * 100;
            
            // Update progress bar
            const progressBar = document.getElementById('dailyProgressBar');
            if (progressBar) progressBar.style.width = `${percentage}%`;
            
            // Update progress text
            const progressText = document.getElementById('dailyProgressText');
            if (progressText) progressText.textContent = `${completed}/${total} brands complete`;
            
            // Legacy support
            const oldBar = document.getElementById('checklistProgressBar');
            if (oldBar) oldBar.style.width = `${percentage}%`;
            
            // Show celebration if all done
            if (completed === total) {
                showDailyComplete();
            }
        }

        function showDailyComplete() {
            const board = document.getElementById('brandActionBoard');
            if (board && !document.getElementById('dailyCompleteMsg')) {
                const msg = document.createElement('div');
                msg.id = 'dailyCompleteMsg';
                msg.className = 'all-complete-msg';
                msg.innerHTML = '🎉 All brands done for today! Great work!';
                board.parentElement.insertBefore(msg, board);
            }
        }

        function openDailyBrandDetail(brandKey) {
            window.currentDailyBrand = brandKey;
            const brandDisplay = BRAND_DISPLAY[brandKey] || brandKey;
            const data = window.dailyBrandData[brandKey] || { gmv: 0, orders: 0, videos: 0, creators: 0 };
            const wins = window.dailyBrandWins[brandKey] || [];
            const attention = window.dailyBrandAttention[brandKey] || [];
            const spotlights = window.dailyBrandSpotlights[brandKey] || [];

            document.getElementById('brandDetailName').textContent = brandDisplay;
            document.getElementById('brandDetailGmv').textContent = fmtMoney(data.gmv);
            document.getElementById('brandDetailOrders').textContent = fmt(data.orders);
            document.getElementById('brandDetailVideos').textContent = fmt(data.videos);
            document.getElementById('brandDetailCreators').textContent = data.creators;

            // Wins
            document.getElementById('brandWinsCount').textContent = wins.length;
            const winsContainer = document.getElementById('brandWinsContainer');
            if (wins.length === 0) {
                winsContainer.innerHTML = '<p style="color: var(--text-muted);">No wins detected for this brand today.</p>';
            } else {
                winsContainer.innerHTML = wins.map((win, i) => `
                    <div class="win-card" style="margin-bottom: 8px;" onclick="copyBrandWin('${brandKey}', ${i})">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <strong>${win.creatorName}</strong>
                            <span class="win-type ${win.type}">${win.typeLabel}</span>
                        </div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 4px;">${win.message}</div>
                    </div>
                `).join('');
            }

            // Attention
            document.getElementById('brandAttentionCount').textContent = attention.length;
            const attentionContainer = document.getElementById('brandAttentionContainer');
            if (attention.length === 0) {
                attentionContainer.innerHTML = '<p style="color: var(--text-muted);">All creators looking good!</p>';
            } else {
                attentionContainer.innerHTML = attention.map(c => `
                    <div style="background: var(--bg-card); padding: 12px; border-radius: 8px; margin-bottom: 8px;">
                        <div style="display: flex; justify-content: space-between;">
                            <strong>${c.name}</strong>
                            <span style="font-size: 0.8rem; color: var(--text-muted);">${fmtMoney(c.gmv)}</span>
                        </div>
                        <div style="font-size: 0.8rem; color: var(--warning); margin-top: 4px;">${c.issues.map(i => i.message).join(' • ')}</div>
                    </div>
                `).join('');
            }

            // Spotlight
            const spotlightContainer = document.getElementById('brandSpotlightContainer');
            if (spotlights.length === 0) {
                spotlightContainer.innerHTML = '<p style="color: var(--text-muted);">No spotlight candidates for this brand.</p>';
            } else {
                const s = spotlights[0];
                spotlightContainer.innerHTML = `
                    <div style="background: var(--bg-card); padding: 16px; border-radius: 8px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <strong>${s.name}</strong>
                            <button class="btn btn-small" onclick="copyBrandSpotlight('${brandKey}')">📋 Copy Shoutout</button>
                        </div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">${s.reason}</div>
                        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 12px;">
                            <div class="mini-stat"><div class="value">${fmtMoney(s.gmv)}</div><div class="label">GMV</div></div>
                            <div class="mini-stat"><div class="value">${s.videos}</div><div class="label">Videos</div></div>
                            <div class="mini-stat"><div class="value">${s.daysActive}</div><div class="label">Days</div></div>
                        </div>
                    </div>
                `;
            }

            document.getElementById('brandDailyDetail').style.display = 'block';
            document.getElementById('brandActionBoard').parentElement.parentElement.style.display = 'none';
        }

        function closeBrandDetail() {
            document.getElementById('brandDailyDetail').style.display = 'none';
            document.getElementById('brandActionBoard').parentElement.parentElement.style.display = 'block';
        }

        function markBrandComplete() {
            if (window.currentDailyBrand) {
                window.completedDailyBrands.add(window.currentDailyBrand);
                saveCompletedDailyBrands();
                closeBrandDetail();
                buildDailyBrandActionBoard();
            }
        }

        function copyBrandWin(brandKey, index) {
            const wins = window.dailyBrandWins[brandKey] || [];
            if (wins[index] && wins[index].content) {
                navigator.clipboard.writeText(wins[index].content);
                // Visual feedback
                event.target.closest('.win-card').style.borderColor = 'var(--success)';
                setTimeout(() => {
                    event.target.closest('.win-card').style.borderColor = '';
                }, 1500);
            }
        }

        function copyBrandSpotlight(brandKey) {
            const spotlights = window.dailyBrandSpotlights[brandKey] || [];
            if (spotlights[0] && spotlights[0].shoutout) {
                navigator.clipboard.writeText(spotlights[0].shoutout);
            }
        }

        // Checklist functionality (legacy - kept for compatibility)
        function updateChecklist() {
            updateDailyProgress();
        }

        function updateWeeklyChecklist() {
            updateWeeklyProgress();
        }

        function updateWeeklyProgress() {
            const total = 5;
            const completed = window.completedWeeklyBrands.size;
            const percentage = (completed / total) * 100;
            document.getElementById('weeklyChecklistProgressBar').style.width = `${percentage}%`;
            
            // Show celebration if all done
            if (completed === total) {
                showWeeklyComplete();
            }
        }

        function showWeeklyComplete() {
            const board = document.getElementById('weeklyBrandBoard');
            if (board && !document.getElementById('weeklyCompleteMsg')) {
                const msg = document.createElement('div');
                msg.id = 'weeklyCompleteMsg';
                msg.className = 'all-complete-msg';
                msg.innerHTML = '🎉 All brands done for the week! Amazing work!';
                board.parentElement.insertBefore(msg, board);
            }
        }

        async function generateMorningMatt(yesterdayData, dayBeforeData, dateStr, brandFilter) {
            // Aggregate yesterday's data
            const brandTotals = {};
            const creatorTotals = {};
            let totalGMV = 0;
            let totalOrders = 0;
            let totalVideos = 0;

            yesterdayData.forEach(row => {
                // Brand totals
                if (!brandTotals[row.brand]) {
                    brandTotals[row.brand] = { gmv: 0, orders: 0, videos: 0, creators: new Set() };
                }
                brandTotals[row.brand].gmv += pFloat(row.gmv);
                brandTotals[row.brand].orders += pInt(row.orders);
                brandTotals[row.brand].videos += pInt(row.videos);
                brandTotals[row.brand].creators.add(row.creator_name);

                // Creator totals
                const key = `${row.creator_name}|||${row.brand}`;
                if (!creatorTotals[key]) {
                    creatorTotals[key] = { name: row.creator_name, brand: row.brand, gmv: 0, orders: 0, videos: 0 };
                }
                creatorTotals[key].gmv += pFloat(row.gmv);
                creatorTotals[key].orders += pInt(row.orders);
                creatorTotals[key].videos += pInt(row.videos);

                totalGMV += pFloat(row.gmv);
                totalOrders += pInt(row.orders);
                totalVideos += pInt(row.videos);
            });

            // Day before totals for comparison (aggregate by brand too)
            let prevGMV = 0;
            const prevBrandTotals = {};
            dayBeforeData.forEach(row => {
                prevGMV += pFloat(row.gmv);
                if (!prevBrandTotals[row.brand]) {
                    prevBrandTotals[row.brand] = { gmv: 0, orders: 0, videos: 0 };
                }
                prevBrandTotals[row.brand].gmv += pFloat(row.gmv);
                prevBrandTotals[row.brand].orders += pInt(row.orders);
                prevBrandTotals[row.brand].videos += pInt(row.videos);
            });
            const gmvChange = prevGMV > 0 ? ((totalGMV - prevGMV) / prevGMV * 100).toFixed(1) : 0;
            const gmvArrow = gmvChange >= 0 ? '📈' : '📉';

            // Calculate per-brand DoD changes
            window.dailyBrandDoD = {};
            Object.keys(brandTotals).forEach(brand => {
                const current = brandTotals[brand].gmv;
                const prev = prevBrandTotals[brand]?.gmv || 0;
                window.dailyBrandDoD[brand] = prev > 0 ? ((current - prev) / prev * 100) : (current > 0 ? 100 : 0);
            });

            // Top 5 creators
            const topCreators = Object.values(creatorTotals)
                .sort((a, b) => b.gmv - a.gmv)
                .slice(0, 5);

            // Brand breakdown sorted by GMV
            const sortedBrands = Object.entries(brandTotals)
                .sort((a, b) => b[1].gmv - a[1].gmv);

            // Find best video (would need video data - simplified for now)
            const bestCreatorByOrders = Object.values(creatorTotals)
                .sort((a, b) => b.orders - a.orders)[0];

            // Generate the message
            let msg = `☀️ MORNING MATT - ${formatDate(dateStr)}

📊 QUICK STATS
Total GMV: ${fmtMoney(totalGMV)} ${gmvArrow} ${gmvChange >= 0 ? '+' : ''}${gmvChange}% vs prior day
Orders: ${fmt(totalOrders)} | Videos Posted: ${fmt(totalVideos)}

🏢 BY BRAND`;

            sortedBrands.forEach(([brand, data]) => {
                const displayName = BRAND_DISPLAY[brand] || brand;
                msg += `\n• ${displayName}: ${fmtMoney(data.gmv)} (${data.creators.size} active creators)`;
            });

            msg += `\n
🏆 TOP 5 PERFORMERS`;
            topCreators.forEach((c, i) => {
                const brandDisplay = BRAND_DISPLAY[c.brand] || c.brand;
                msg += `\n${i + 1}. ${c.name} (${brandDisplay}) - ${fmtMoney(c.gmv)}`;
            });

            msg += `\n
💬 TALKING POINTS
• Total active creators yesterday: ${Object.keys(creatorTotals).length}
• Highest converting creator: ${bestCreatorByOrders?.name || 'N/A'} (${bestCreatorByOrders?.orders || 0} orders)
• Average GMV per creator: ${fmtMoney(totalGMV / Math.max(Object.keys(creatorTotals).length, 1))}`;

            // Check for any notable achievements
            const bigWinners = Object.values(creatorTotals).filter(c => c.gmv >= 1000);
            if (bigWinners.length > 0) {
                msg += `\n• ${bigWinners.length} creator(s) hit $1K+ GMV yesterday! 🔥`;
            }

            document.getElementById('morningMattContent').textContent = msg;

            // Populate brand data for action board
            Object.entries(brandTotals).forEach(([brandKey, data]) => {
                window.dailyBrandData[brandKey] = {
                    gmv: data.gmv,
                    orders: data.orders,
                    videos: data.videos,
                    creators: data.creators.size
                };
            });
        }

        async function detectDailyWins(yesterdayData, dayBeforeData, allTimeData) {
            const wins = [];

            // Aggregate current totals by creator
            const creatorTotals = {};
            yesterdayData.forEach(row => {
                const key = `${row.creator_name}|||${row.brand}`;
                if (!creatorTotals[key]) {
                    creatorTotals[key] = { name: row.creator_name, brand: row.brand, gmv: 0, orders: 0, videos: 0 };
                }
                creatorTotals[key].gmv += pFloat(row.gmv);
                creatorTotals[key].orders += pInt(row.orders);
                creatorTotals[key].videos += pInt(row.videos);
            });

            // Day before totals
            const dayBeforeTotals = {};
            dayBeforeData.forEach(row => {
                const key = `${row.creator_name}|||${row.brand}`;
                if (!dayBeforeTotals[key]) {
                    dayBeforeTotals[key] = { gmv: 0, orders: 0 };
                }
                dayBeforeTotals[key].gmv += pFloat(row.gmv);
                dayBeforeTotals[key].orders += pInt(row.orders);
            });

            // All-time totals for tier tracking
            const allTimeTotals = {};
            allTimeData.forEach(row => {
                const key = `${row.creator_name}|||${row.brand}`;
                if (!allTimeTotals[key]) {
                    allTimeTotals[key] = { name: row.creator_name, brand: row.brand, gmv: 0 };
                }
                allTimeTotals[key].gmv += pFloat(row.gmv);
            });

            // Detect wins
            Object.entries(creatorTotals).forEach(([key, data]) => {
                const brandDisplay = BRAND_DISPLAY[data.brand] || data.brand;
                const prevData = dayBeforeTotals[key];
                const allTime = allTimeTotals[key];

                // First Sale Detection (had 0 orders day before, has orders now)
                if (data.orders > 0 && (!prevData || prevData.orders === 0)) {
                    wins.push({
                        type: 'first-sale',
                        typeName: 'First Sale',
                        creator: data.name,
                        brand: brandDisplay,
                        content: `🏆 CREATOR WIN - FIRST SALE!\n\nCreator: @${data.name}\nBrand: ${brandDisplay}\nAchievement: Made their first sale! 🎉\nOrders: ${data.orders} | GMV: ${fmtMoney(data.gmv)}`,
                        priority: 5
                    });
                }

                // GMV Milestone Detection
                const milestones = [10000, 5000, 2500, 1000, 500];
                milestones.forEach(milestone => {
                    if (data.gmv >= milestone && (!prevData || prevData.gmv < milestone)) {
                        wins.push({
                            type: 'milestone',
                            typeName: `$${milestone >= 1000 ? (milestone/1000) + 'K' : milestone} Day`,
                            creator: data.name,
                            brand: brandDisplay,
                            content: `🏆 CREATOR WIN - GMV MILESTONE!\n\nCreator: @${data.name}\nBrand: ${brandDisplay}\nAchievement: Hit ${fmtMoney(milestone)}+ in a single day! 💰\nActual GMV: ${fmtMoney(data.gmv)}`,
                            priority: milestone >= 5000 ? 4 : 3
                        });
                    }
                });

                // Tier Promotion Detection
                if (allTime) {
                    const prevDayAllTime = allTime.gmv - data.gmv;
                    const prevTier = getTierFromGMV(prevDayAllTime);
                    const newTier = getTierFromGMV(allTime.gmv);
                    
                    if (prevTier !== newTier && TIER_THRESHOLDS[newTier] > (TIER_THRESHOLDS[prevTier] || 0)) {
                        wins.push({
                            type: 'tier',
                            typeName: 'Tier Up',
                            creator: data.name,
                            brand: brandDisplay,
                            content: `🏆 CREATOR WIN - TIER PROMOTION!\n\nCreator: @${data.name}\nBrand: ${brandDisplay}\nAchievement: Advanced to ${TIER_NAMES[newTier]} tier! 🚀\nAll-Time GMV: ${fmtMoney(allTime.gmv)}`,
                            priority: 4
                        });
                    }
                }

                // Personal Best Detection (beat their own record)
                if (prevData && data.gmv > prevData.gmv * 2 && data.gmv >= 100) {
                    wins.push({
                        type: 'personal-best',
                        typeName: 'Personal Best',
                        creator: data.name,
                        brand: brandDisplay,
                        content: `🏆 CREATOR WIN - PERSONAL BEST!\n\nCreator: @${data.name}\nBrand: ${brandDisplay}\nAchievement: More than doubled their GMV! 📈\nYesterday: ${fmtMoney(data.gmv)} vs Prior: ${fmtMoney(prevData.gmv)}`,
                        priority: 2
                    });
                }
            });

            // Sort by priority and render
            wins.sort((a, b) => b.priority - a.priority);

            const container = document.getElementById('dailyWinsContainer');
            document.getElementById('winsCount').textContent = `${wins.length} win${wins.length !== 1 ? 's' : ''}`;

            if (wins.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <div class="icon">📊</div>
                        <h3>No notable wins detected</h3>
                        <p>Check back after more data is uploaded</p>
                    </div>`;
                return;
            }

            // Store wins globally for click handler
            window.dailyWins = wins;

            // Populate wins by brand for action board
            window.dailyBrandWins = {};
            wins.forEach(win => {
                // Find the brand key from the display name
                const brandKey = Object.keys(BRAND_DISPLAY).find(k => BRAND_DISPLAY[k] === win.brand) || win.brand;
                if (!window.dailyBrandWins[brandKey]) {
                    window.dailyBrandWins[brandKey] = [];
                }
                window.dailyBrandWins[brandKey].push({
                    creatorName: win.creator,
                    type: win.type,
                    typeLabel: win.typeName,
                    message: win.content.split('\n')[3] || win.typeName, // Get the achievement line
                    content: win.content
                });
            });

            container.innerHTML = wins.map((win, index) => `
                <div class="win-card" data-win-index="${index}" onclick="copyWinByIndex(${index})">
                    <div class="win-header">
                        <span class="win-type ${win.type}">${win.typeName}</span>
                        <span class="win-brand">${win.brand}</span>
                    </div>
                    <div class="win-creator">${win.creator}</div>
                    <div class="win-content">${win.content}</div>
                    <div class="win-hint">Click to copy</div>
                </div>
            `).join('');
        }

        function copyWinByIndex(index) {
            const win = window.dailyWins[index];
            if (!win) return;
            const element = document.querySelector(`.win-card[data-win-index="${index}"]`);
            navigator.clipboard.writeText(win.content).then(() => {
                element.classList.add('copied');
                const hint = element.querySelector('.win-hint');
                hint.textContent = '✅ Copied to clipboard!';
                setTimeout(() => {
                    element.classList.remove('copied');
                    hint.textContent = 'Click to copy';
                }, 2000);
            });
        }

        function detectDailyAttention(yesterdayData, dayBeforeData, allTimeData) {
            // Reset daily attention
            window.dailyBrandAttention = {};

            // Aggregate yesterday by creator
            const yesterdayTotals = {};
            yesterdayData.forEach(row => {
                const key = `${row.creator_name}|||${row.brand}`;
                if (!yesterdayTotals[key]) {
                    yesterdayTotals[key] = { name: row.creator_name, brand: row.brand, gmv: 0, orders: 0, videos: 0 };
                }
                yesterdayTotals[key].gmv += pFloat(row.gmv);
                yesterdayTotals[key].orders += pInt(row.orders);
                yesterdayTotals[key].videos += pInt(row.videos);
            });

            // Aggregate day before by creator
            const dayBeforeTotals = {};
            dayBeforeData.forEach(row => {
                const key = `${row.creator_name}|||${row.brand}`;
                if (!dayBeforeTotals[key]) {
                    dayBeforeTotals[key] = { name: row.creator_name, brand: row.brand, gmv: 0, orders: 0, videos: 0 };
                }
                dayBeforeTotals[key].gmv += pFloat(row.gmv);
                dayBeforeTotals[key].orders += pInt(row.orders);
                dayBeforeTotals[key].videos += pInt(row.videos);
            });

            // Calculate 30-day averages
            const creatorAverages = {};
            allTimeData.forEach(row => {
                const key = `${row.creator_name}|||${row.brand}`;
                if (!creatorAverages[key]) {
                    creatorAverages[key] = { name: row.creator_name, brand: row.brand, totalGmv: 0, days: new Set() };
                }
                creatorAverages[key].totalGmv += pFloat(row.gmv);
                creatorAverages[key].days.add(row.report_date);
            });

            // Detect attention issues
            Object.entries(yesterdayTotals).forEach(([key, data]) => {
                const issues = [];
                const prev = dayBeforeTotals[key];
                const avg = creatorAverages[key];
                const avgDaily = avg ? (avg.totalGmv / Math.max(avg.days.size, 1)) : 0;

                // GMV decline vs day before (>50% drop from meaningful day)
                if (prev && prev.gmv >= 50 && data.gmv < prev.gmv * 0.5) {
                    issues.push({
                        type: 'gmv_decline',
                        severity: 2,
                        message: `GMV down ${((1 - data.gmv / prev.gmv) * 100).toFixed(0)}% vs day before`
                    });
                }

                // Underperforming vs average (>60% below their normal)
                if (avgDaily >= 50 && data.gmv < avgDaily * 0.4) {
                    issues.push({
                        type: 'below_average',
                        severity: 2,
                        message: `${((1 - data.gmv / avgDaily) * 100).toFixed(0)}% below their usual ${fmtMoney(avgDaily)}/day`
                    });
                }

                // No videos posted (for active creators)
                if (data.videos === 0 && avg && avg.days.size >= 5) {
                    issues.push({
                        type: 'no_videos',
                        severity: 1,
                        message: 'No videos posted yesterday'
                    });
                }

                // Zero GMV for previously active creator
                if (data.gmv === 0 && prev && prev.gmv >= 100) {
                    issues.push({
                        type: 'zero_gmv',
                        severity: 2,
                        message: `Zero GMV (had ${fmtMoney(prev.gmv)} day before)`
                    });
                }

                if (issues.length > 0) {
                    if (!window.dailyBrandAttention[data.brand]) {
                        window.dailyBrandAttention[data.brand] = [];
                    }
                    window.dailyBrandAttention[data.brand].push({
                        name: data.name,
                        brand: BRAND_DISPLAY[data.brand] || data.brand,
                        gmv: data.gmv,
                        prevGmv: prev?.gmv || 0,
                        avgGmv: avgDaily,
                        videos: data.videos,
                        issues
                    });
                }
            });

            // Check for creators who were active day before but not yesterday
            Object.entries(dayBeforeTotals).forEach(([key, prev]) => {
                if (!yesterdayTotals[key] && prev.gmv >= 100) {
                    const [name, brand] = key.split('|||');
                    if (!window.dailyBrandAttention[brand]) {
                        window.dailyBrandAttention[brand] = [];
                    }
                    window.dailyBrandAttention[brand].push({
                        name,
                        brand: BRAND_DISPLAY[brand] || brand,
                        gmv: 0,
                        prevGmv: prev.gmv,
                        avgGmv: 0,
                        videos: 0,
                        issues: [{
                            type: 'inactive',
                            severity: 2,
                            message: `No activity (had ${fmtMoney(prev.gmv)} day before)`
                        }]
                    });
                }
            });
        }

        async function suggestSpotlight(yesterdayData, allTimeData) {
            // Aggregate all-time data
            const creatorStats = {};
            allTimeData.forEach(row => {
                // Only include managed creators
                if (!isManagedForBrand(row.creator_name, row.brand)) return;
                
                const key = `${row.creator_name}|||${row.brand}`;
                if (!creatorStats[key]) {
                    creatorStats[key] = { 
                        name: row.creator_name, 
                        brand: row.brand, 
                        gmv: 0, 
                        orders: 0, 
                        videos: 0,
                        days: new Set()
                    };
                }
                creatorStats[key].gmv += pFloat(row.gmv);
                creatorStats[key].orders += pInt(row.orders);
                creatorStats[key].videos += pInt(row.videos);
                creatorStats[key].days.add(row.report_date);
            });

            // Calculate scores for each creator
            spotlightCandidates = Object.values(creatorStats)
                .filter(c => c.gmv >= 100) // Minimum threshold
                .map(c => {
                    const daysActive = c.days.size;
                    const avgGMVPerDay = c.gmv / Math.max(daysActive, 1);
                    const conversionRate = c.videos > 0 ? (c.orders / c.videos) : 0;
                    
                    // Score based on consistency, growth, and performance
                    const consistencyScore = Math.min(daysActive / 20, 1) * 30; // Up to 30 points for consistency
                    const gmvScore = Math.min(c.gmv / 10000, 1) * 40; // Up to 40 points for total GMV
                    const conversionScore = Math.min(conversionRate / 0.5, 1) * 30; // Up to 30 points for conversion

                    return {
                        ...c,
                        daysActive,
                        avgGMVPerDay,
                        conversionRate,
                        score: consistencyScore + gmvScore + conversionScore
                    };
                })
                .sort((a, b) => b.score - a.score);

            // Filter out recently spotlighted
            spotlightCandidates = spotlightCandidates.filter(c => 
                !recentSpotlights.includes(`${c.name}|||${c.brand}`)
            );

            // Populate spotlights by brand for action board
            window.dailyBrandSpotlights = {};
            spotlightCandidates.forEach(c => {
                if (!window.dailyBrandSpotlights[c.brand]) {
                    // Determine spotlight reason
                    let reason = '';
                    if (c.daysActive >= 15) {
                        reason = `Consistency Champion - Active ${c.daysActive} days!`;
                    } else if (c.conversionRate >= 0.3) {
                        reason = `High Converter - ${(c.conversionRate * 100).toFixed(0)}% videos drive sales`;
                    } else if (c.avgGMVPerDay >= 500) {
                        reason = `Revenue Driver - Avg ${fmtMoney(c.avgGMVPerDay)}/day`;
                    } else {
                        reason = `Rising Star - Solid performance`;
                    }

                    const shoutout = `CREATOR SHOUTOUT 📣\n\nGiving @${c.name} 😎 ✨ a big shout-out today...\n\n${reason}\n\nKeep up the amazing work! 🙌`;

                    window.dailyBrandSpotlights[c.brand] = [{
                        name: c.name,
                        gmv: c.gmv,
                        videos: c.videos,
                        daysActive: c.daysActive,
                        reason,
                        shoutout
                    }];
                }
            });

            currentSpotlightIndex = 0;
            renderSpotlight();
        }

        function renderSpotlight() {
            const container = document.getElementById('spotlightContainer');
            
            if (spotlightCandidates.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <div class="icon">📊</div>
                        <h3>No spotlight candidates</h3>
                        <p>Need more creator data to suggest spotlights</p>
                    </div>`;
                return;
            }

            const creator = spotlightCandidates[currentSpotlightIndex];
            const brandDisplay = BRAND_DISPLAY[creator.brand] || creator.brand;
            const tier = getTierFromGMV(creator.gmv);

            // Determine spotlight reason
            let reason = '';
            if (creator.daysActive >= 15) {
                reason = `🔥 Consistency Champion - Active ${creator.daysActive} days in the last 30!`;
            } else if (creator.conversionRate >= 0.3) {
                reason = `⚡ High Converter - ${(creator.conversionRate * 100).toFixed(0)}% of their videos drive sales!`;
            } else if (creator.avgGMVPerDay >= 500) {
                reason = `💰 Revenue Driver - Averaging ${fmtMoney(creator.avgGMVPerDay)} per active day!`;
            } else {
                reason = `📈 Rising Star - Solid performance with room to grow!`;
            }

            // Generate shoutout copy
            const shoutoutCopy = `CREATOR SHOUTOUT 📣

Giving @${creator.name} 😎 ✨ a big shout-out today...

${reason.replace(/[🔥⚡💰📈]/g, '')}

${creator.daysActive >= 10 ? `They've been consistently showing up and posting content. ` : ''}${creator.gmv >= 1000 ? `They've driven ${fmtMoney(creator.gmv)} in GMV so far! ` : ''}${creator.conversionRate >= 0.2 ? `Their content converts at an impressive rate. ` : ''}

Keep up the amazing work! 🙌`;

            container.innerHTML = `
                <div class="spotlight-card">
                    <div class="spotlight-header">
                        <div>
                            <div class="spotlight-creator">@${creator.name}</div>
                            <div class="spotlight-brand">${brandDisplay} • ${TIER_NAMES[tier]}</div>
                        </div>
                        <div style="font-size: 0.8rem; color: var(--text-muted);">
                            Candidate ${currentSpotlightIndex + 1} of ${spotlightCandidates.length}
                        </div>
                    </div>
                    <div class="spotlight-stats">
                        <div class="spotlight-stat">
                            <div class="value">${fmtMoney(creator.gmv)}</div>
                            <div class="label">Total GMV</div>
                        </div>
                        <div class="spotlight-stat">
                            <div class="value">${creator.daysActive}</div>
                            <div class="label">Days Active</div>
                        </div>
                        <div class="spotlight-stat">
                            <div class="value">${fmt(creator.videos)}</div>
                            <div class="label">Videos</div>
                        </div>
                        <div class="spotlight-stat">
                            <div class="value">${(creator.conversionRate * 100).toFixed(0)}%</div>
                            <div class="label">Conv. Rate</div>
                        </div>
                    </div>
                    <div class="spotlight-reason">${reason}</div>
                    <div class="spotlight-copy" id="spotlightCopy">${shoutoutCopy}</div>
                    <div class="spotlight-actions">
                        <button class="btn btn-primary" onclick="copySpotlight()">📋 Copy Shoutout</button>
                        <button class="btn" onclick="markSpotlighted()">✅ Used This One</button>
                    </div>
                </div>
            `;
        }

        function getNewSpotlight() {
            currentSpotlightIndex = (currentSpotlightIndex + 1) % Math.max(spotlightCandidates.length, 1);
            renderSpotlight();
        }

        function copySpotlight() {
            const text = document.getElementById('spotlightCopy').textContent;
            const btn = document.querySelector('.spotlight-actions .btn-primary');
            navigator.clipboard.writeText(text).then(() => {
                btn.textContent = '✅ Copied!';
                btn.style.background = 'var(--success)';
                setTimeout(() => {
                    btn.textContent = '📋 Copy Shoutout';
                    btn.style.background = '';
                }, 2000);
            });
        }

        function markSpotlighted() {
            const creator = spotlightCandidates[currentSpotlightIndex];
            if (creator) {
                recentSpotlights.push(`${creator.name}|||${creator.brand}`);
                if (recentSpotlights.length > 10) recentSpotlights.shift(); // Keep last 10
                spotlightCandidates.splice(currentSpotlightIndex, 1);
                currentSpotlightIndex = Math.min(currentSpotlightIndex, spotlightCandidates.length - 1);
                renderSpotlight();
            }
        }

