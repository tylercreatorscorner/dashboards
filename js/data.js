// ==================== DATA & VALIDATION ====================
        // ==================== DATA HEALTH CHECK ====================
        // Store data globally for filtering
        window.dataHealthRows = [];
        
        // File type display names and expected filenames
        const FILE_TYPES = {
            creator: { name: 'Creator Data', icon: '👤', table: 'creator_performance' },
            video: { name: 'Video Data', icon: '🎬', table: 'video_performance' },
            product: { name: 'Product Data', icon: '📦', table: 'product_performance' },
            shop: { name: 'Shop Analytics', icon: '🛒', table: 'shop_analytics' },
            affiliate: { name: 'Affiliate Data', icon: '🔗', table: 'affiliate_summary' }
        };
        
        async function loadDataHealth() {
            try {
                const daysBack = parseInt(document.getElementById('dataStatusDays')?.value) || 7;
                
                // Calculate date range
                const endDate = new Date();
                endDate.setDate(endDate.getDate() - 1); // Yesterday
                const startDate = new Date();
                startDate.setDate(startDate.getDate() - daysBack);
                
                const startStr = localDateStr(startDate);
                const endStr = localDateStr(endDate);
                
                const brands = ['catakor', 'jiyu', 'physicians_choice', 'peach_slices', 'yerba_magic'];
                
                // Try RPC first, fallback to direct queries
                let allRows = [];
                
                const { data: rpcData, error: rpcError } = await supabaseClient.rpc('get_data_health_v2', { 
                    p_start_date: startStr, 
                    p_end_date: endStr 
                });
                
                if (!rpcError && rpcData && rpcData.length > 0) {
                    allRows = rpcData;
                } else {
                    // Fallback: Query each table directly
                    console.log('Using fallback data health queries');
                    
                    // Helper to normalize date from Supabase (might be ISO string or date)
                    const normalizeDate = (d) => {
                        if (!d) return '';
                        const str = String(d);
                        return str.includes('T') ? str.split('T')[0] : str.substring(0, 10);
                    };
                    
                    // Note: We need high limits because tables have many rows per date+brand
                    // We only care about distinct date+brand combos, so we'll dedupe into Sets
                    
                    // Get creator data dates
                    const { data: dateData } = await supabaseClient
                        .from('creator_performance')
                        .select('report_date, brand')
                        .gte('report_date', startStr)
                        .lte('report_date', endStr)
                        .eq('period_type', 'daily')
                        .limit(50000);
                    
                    // Build set of date+brand combos with creator data
                    const creatorSet = new Set();
                    (dateData || []).forEach(d => creatorSet.add(`${normalizeDate(d.report_date)}|${d.brand}`));
                    
                    // Get video data dates
                    const { data: videoData } = await supabaseClient
                        .from('video_performance')
                        .select('report_date, brand')
                        .gte('report_date', startStr)
                        .lte('report_date', endStr)
                        .eq('period_type', 'daily')
                        .limit(50000);
                    const videoSet = new Set();
                    (videoData || []).forEach(d => videoSet.add(`${normalizeDate(d.report_date)}|${d.brand}`));
                    
                    // Get product data dates
                    const { data: productData } = await supabaseClient
                        .from('product_performance')
                        .select('report_date, brand')
                        .gte('report_date', startStr)
                        .lte('report_date', endStr)
                        .eq('period_type', 'daily')
                        .limit(50000);
                    const productSet = new Set();
                    (productData || []).forEach(d => productSet.add(`${normalizeDate(d.report_date)}|${d.brand}`));
                    
                    // Get shop analytics dates
                    const { data: shopData } = await supabaseClient
                        .from('shop_analytics')
                        .select('report_date, brand')
                        .gte('report_date', startStr)
                        .lte('report_date', endStr)
                        .eq('period_type', 'daily')
                        .limit(50000);
                    const shopSet = new Set();
                    (shopData || []).forEach(d => shopSet.add(`${normalizeDate(d.report_date)}|${d.brand}`));
                    
                    // Get affiliate data dates (no period_type filter)
                    const { data: affiliateData } = await supabaseClient
                        .from('affiliate_summary')
                        .select('report_date, brand')
                        .gte('report_date', startStr)
                        .lte('report_date', endStr)
                        .limit(50000);
                    const affiliateSet = new Set();
                    (affiliateData || []).forEach(d => affiliateSet.add(`${normalizeDate(d.report_date)}|${d.brand}`));
                    
                    // Generate all expected date+brand combos
                    const allDates = [];
                    let currentDate = new Date(startDate);
                    while (currentDate <= endDate) {
                        allDates.push(localDateStr(currentDate));
                        currentDate.setDate(currentDate.getDate() + 1);
                    }
                    
                    // Build the status matrix
                    allDates.forEach(date => {
                        brands.forEach(brand => {
                            const key = `${date}|${brand}`;
                            allRows.push({
                                report_date: date,
                                brand: brand,
                                has_creator: creatorSet.has(key),
                                has_video: videoSet.has(key),
                                has_product: productSet.has(key),
                                has_shop: shopSet.has(key),
                                has_affiliate: affiliateSet.has(key)
                            });
                        });
                    });
                }
                
                window.dataHealthRows = allRows;
                
                // Find rows with any missing data
                const missing = allRows.filter(row => 
                    !row.has_creator || !row.has_video || !row.has_product || !row.has_shop || !row.has_affiliate
                );
                
                // Build list of missing files with details
                const missingFiles = [];
                missing.forEach(row => {
                    const dateFormatted = formatDate(row.report_date);
                    if (!row.has_creator) missingFiles.push({ date: row.report_date, dateFormatted, brand: row.brand, type: 'creator' });
                    if (!row.has_video) missingFiles.push({ date: row.report_date, dateFormatted, brand: row.brand, type: 'video' });
                    if (!row.has_product) missingFiles.push({ date: row.report_date, dateFormatted, brand: row.brand, type: 'product' });
                    if (!row.has_shop) missingFiles.push({ date: row.report_date, dateFormatted, brand: row.brand, type: 'shop' });
                    if (!row.has_affiliate) missingFiles.push({ date: row.report_date, dateFormatted, brand: row.brand, type: 'affiliate' });
                });
                
                // Store for copy function
                window.missingFilesList = missingFiles;
                
                // Count complete days (all 5 brands complete for that day)
                const dateCompleteness = {};
                allRows.forEach(row => {
                    if (!dateCompleteness[row.report_date]) {
                        dateCompleteness[row.report_date] = { total: 0, complete: 0 };
                    }
                    dateCompleteness[row.report_date].total++;
                    if (row.has_creator && row.has_video && row.has_product && row.has_shop && row.has_affiliate) {
                        dateCompleteness[row.report_date].complete++;
                    }
                });
                
                const completeDays = Object.values(dateCompleteness).filter(d => d.complete === d.total).length;
                
                // Get latest date with creator data
                const latestDate = allRows.filter(r => r.has_creator).sort((a, b) => b.report_date.localeCompare(a.report_date))[0]?.report_date;
                
                // Count brands up-to-date (has data for yesterday)
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                const yesterdayStr = localDateStr(yesterday);
                const brandsUpToDate = brands.filter(brand => 
                    allRows.some(r => r.brand === brand && r.report_date === yesterdayStr && r.has_creator)
                ).length;
                
                // Update stats
                document.getElementById('dataCompleteCount').textContent = completeDays;
                document.getElementById('dataMissingCount').textContent = missingFiles.length;
                document.getElementById('dataLatestDate').textContent = latestDate ? formatDate(latestDate).split(',')[0] : '--';
                document.getElementById('dataBrandsComplete').textContent = `${brandsUpToDate}/5`;
                
                const matrixCountEl = document.getElementById('dataMatrixCount');
                if (matrixCountEl) matrixCountEl.textContent = `${allRows.length} cells`;
                
                // Update status banner
                const bannerIcon = document.getElementById('statusBannerIcon');
                const bannerTitle = document.getElementById('statusBannerTitle');
                const bannerSubtitle = document.getElementById('statusBannerSubtitle');
                const banner = document.getElementById('dataStatusBanner');
                
                if (missingFiles.length === 0) {
                    banner.style.background = 'linear-gradient(135deg, var(--success-dim), var(--bg-card))';
                    bannerIcon.textContent = '✅';
                    bannerTitle.textContent = 'All caught up!';
                    bannerTitle.style.color = 'var(--success)';
                    bannerSubtitle.textContent = `All ${daysBack} days have complete data for all brands`;
                } else {
                    // Check how urgent
                    const recentMissing = missingFiles.filter(f => {
                        const daysAgo = Math.floor((new Date() - new Date(f.date)) / (1000 * 60 * 60 * 24));
                        return daysAgo <= 2;
                    });
                    
                    if (recentMissing.length > 0) {
                        banner.style.background = 'linear-gradient(135deg, var(--danger-dim), var(--bg-card))';
                        bannerIcon.textContent = '🚨';
                        bannerTitle.textContent = `${recentMissing.length} urgent file${recentMissing.length > 1 ? 's' : ''} needed!`;
                        bannerTitle.style.color = 'var(--danger)';
                        bannerSubtitle.textContent = `Recent data is missing - upload these first`;
                    } else {
                        banner.style.background = 'linear-gradient(135deg, var(--warning-dim), var(--bg-card))';
                        bannerIcon.textContent = '⚠️';
                        bannerTitle.textContent = `${missingFiles.length} file${missingFiles.length > 1 ? 's' : ''} to upload`;
                        bannerTitle.style.color = 'var(--warning)';
                        bannerSubtitle.textContent = `Some older data is incomplete`;
                    }
                }
                
                // Update action required section
                const actionSection = document.getElementById('actionRequiredSection');
                const actionList = document.getElementById('actionRequiredList');
                
                if (missingFiles.length > 0) {
                    actionSection.style.display = 'block';
                    document.getElementById('totalMissingBadge').textContent = `${missingFiles.length} files`;
                    
                    // Group by date, sorted newest first
                    const byDate = {};
                    missingFiles.forEach(f => {
                        if (!byDate[f.date]) byDate[f.date] = [];
                        byDate[f.date].push(f);
                    });
                    
                    actionList.innerHTML = Object.entries(byDate)
                        .sort((a, b) => b[0].localeCompare(a[0]))
                        .map(([date, files]) => {
                            const daysAgo = Math.floor((new Date() - new Date(date)) / (1000 * 60 * 60 * 24));
                            const urgencyLabel = daysAgo === 0 ? '🔴 TODAY' : daysAgo === 1 ? '🟠 Yesterday' : daysAgo <= 3 ? '🟡 Recent' : '';
                            
                            return `
                                <div class="action-date-group" style="border-bottom: 1px solid var(--border-light); padding: 16px;">
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                                        <div style="font-weight: 600; color: var(--text-primary);">${formatDate(date)}</div>
                                        ${urgencyLabel ? `<span class="badge" style="background: ${daysAgo <= 1 ? 'var(--danger)' : daysAgo <= 3 ? 'var(--warning)' : 'var(--text-muted)'}; font-size: 0.7rem;">${urgencyLabel}</span>` : ''}
                                    </div>
                                    <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                                        ${files.map(f => `
                                            <div class="missing-file-chip" style="
                                                display: inline-flex;
                                                align-items: center;
                                                gap: 6px;
                                                padding: 8px 12px;
                                                background: var(--bg-secondary);
                                                border-radius: 8px;
                                                font-size: 0.85rem;
                                                border: 1px solid var(--border-light);
                                            ">
                                                <span>${FILE_TYPES[f.type].icon}</span>
                                                <span style="font-weight: 500;">${BRAND_DISPLAY[f.brand]}</span>
                                                <span style="color: var(--text-muted);">-</span>
                                                <span style="color: var(--text-secondary);">${FILE_TYPES[f.type].name}</span>
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                            `;
                        }).join('');
                } else {
                    actionSection.style.display = 'none';
                }
                
                // Update upload checklist
                renderUploadChecklist(allRows);
                
                // Build full table (collapsed by default)
                const bodyEl = document.getElementById('dataStatusBody');
                if (bodyEl) {
                    bodyEl.innerHTML = allRows.map(row => {
                        const isComplete = row.has_creator && row.has_video && row.has_product && row.has_shop && row.has_affiliate;
                        return `
                            <tr>
                                <td>${formatDate(row.report_date)}</td>
                                <td>${BRAND_DISPLAY[row.brand] || row.brand}</td>
                                <td style="text-align: center;" class="${row.has_creator ? 'status-ok' : 'status-missing'}">${row.has_creator ? '✓' : '✗'}</td>
                                <td style="text-align: center;" class="${row.has_video ? 'status-ok' : 'status-missing'}">${row.has_video ? '✓' : '✗'}</td>
                                <td style="text-align: center;" class="${row.has_product ? 'status-ok' : 'status-missing'}">${row.has_product ? '✓' : '✗'}</td>
                                <td style="text-align: center;" class="${row.has_shop ? 'status-ok' : 'status-missing'}">${row.has_shop ? '✓' : '✗'}</td>
                                <td style="text-align: center;" class="${row.has_affiliate ? 'status-ok' : 'status-missing'}">${row.has_affiliate ? '✓' : '✗'}</td>
                                <td style="text-align: center;">${isComplete ? '<span style="color: var(--success);">✅ Complete</span>' : '<span style="color: var(--warning);">⚠️ Incomplete</span>'}</td>
                            </tr>
                        `;
                    }).join('');
                }
            } catch (err) {
                console.error('Error in loadDataHealth:', err);
            }
        }
        
        function renderUploadChecklist(allRows) {
            const brandFilter = document.getElementById('checklistBrandFilter')?.value || 'all';
            const bodyEl = document.getElementById('uploadChecklistBody');
            if (!bodyEl) return;
            
            // Filter rows
            let rows = brandFilter === 'all' ? allRows : allRows.filter(r => r.brand === brandFilter);
            
            // Group by date
            const byDate = {};
            rows.forEach(row => {
                if (!byDate[row.report_date]) byDate[row.report_date] = {};
                byDate[row.report_date][row.brand] = row;
            });
            
            const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));
            
            if (dates.length === 0) {
                bodyEl.innerHTML = '<div style="padding: 40px; text-align: center; color: var(--text-muted);">No data found</div>';
                return;
            }
            
            bodyEl.innerHTML = dates.map(date => {
                const brands = byDate[date];
                const allComplete = Object.values(brands).every(b => 
                    b.has_creator && b.has_video && b.has_product && b.has_shop && b.has_affiliate
                );
                
                return `
                    <details class="checklist-date-group" ${dates.indexOf(date) < 3 ? 'open' : ''}>
                        <summary style="
                            padding: 12px 16px;
                            cursor: pointer;
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            background: var(--bg-secondary);
                            border-bottom: 1px solid var(--border-light);
                        ">
                            <span style="font-weight: 500;">${formatDate(date)}</span>
                            <span style="color: ${allComplete ? 'var(--success)' : 'var(--warning)'};">
                                ${allComplete ? '✅ Complete' : '⚠️ Incomplete'}
                            </span>
                        </summary>
                        <div style="padding: 12px 16px;">
                            ${Object.entries(brands).map(([brand, data]) => {
                                const types = [
                                    { key: 'has_creator', type: 'creator' },
                                    { key: 'has_video', type: 'video' },
                                    { key: 'has_product', type: 'product' },
                                    { key: 'has_shop', type: 'shop' },
                                    { key: 'has_affiliate', type: 'affiliate' }
                                ];
                                return `
                                    <div style="margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid var(--border-light);">
                                        <div style="font-weight: 600; margin-bottom: 8px; color: var(--text-primary);">${BRAND_DISPLAY[brand]}</div>
                                        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                                            ${types.map(t => {
                                                const hasData = data[t.key];
                                                return `
                                                    <div style="
                                                        display: inline-flex;
                                                        align-items: center;
                                                        gap: 4px;
                                                        padding: 4px 10px;
                                                        border-radius: 6px;
                                                        font-size: 0.8rem;
                                                        background: ${hasData ? 'var(--success-dim)' : 'var(--danger-dim)'};
                                                        color: ${hasData ? 'var(--success)' : 'var(--danger)'};
                                                    ">
                                                        ${hasData ? '✓' : '✗'} ${FILE_TYPES[t.type].icon} ${FILE_TYPES[t.type].name}
                                                    </div>
                                                `;
                                            }).join('')}
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </details>
                `;
            }).join('');
        }
        
        function filterDataChecklist() {
            renderUploadChecklist(window.dataHealthRows || []);
        }
        
        function copyMissingDataList() {
            const missing = window.missingFilesList || [];
            if (missing.length === 0) {
                showToast('No missing files to copy!', 'success');
                return;
            }
            
            // Group by date
            const byDate = {};
            missing.forEach(f => {
                if (!byDate[f.date]) byDate[f.date] = [];
                byDate[f.date].push(f);
            });
            
            let text = `📊 MISSING DATA FILES (${missing.length} total)\n`;
            text += `Generated: ${new Date().toLocaleString()}\n`;
            text += `${'─'.repeat(40)}\n\n`;
            
            Object.entries(byDate)
                .sort((a, b) => b[0].localeCompare(a[0]))
                .forEach(([date, files]) => {
                    text += `📅 ${formatDate(date)}\n`;
                    files.forEach(f => {
                        text += `   • ${BRAND_DISPLAY[f.brand]} - ${FILE_TYPES[f.type].name}\n`;
                    });
                    text += '\n';
                });
            
            navigator.clipboard.writeText(text);
            showToast(`Copied ${missing.length} missing files to clipboard!`, 'success');
        }

        // ==================== DATA VALIDATION ====================
        let validationData = [];
        
        async function loadValidationData() {
            showLoading('validation', 'Loading validation data...');
            
            try {
                const brand = document.getElementById('validationBrandFilter').value;
                const days = parseInt(document.getElementById('validationDays').value) || 7;
                
                // Calculate date range
                const endDate = new Date();
                endDate.setDate(endDate.getDate() - 1); // Yesterday
                const startDate = new Date();
                startDate.setDate(startDate.getDate() - days);
                
                const startStr = localDateStr(startDate);
                const endStr = localDateStr(endDate);
                
                updateLoadingMessage('validation', 'Fetching affiliate summary data...');
                
                // Fetch affiliate summary data
                let affQuery = supabaseClient
                    .from('affiliate_summary')
                    .select('*')
                    .gte('report_date', startStr)
                    .lte('report_date', endStr);
                if (brand !== 'all') affQuery = affQuery.eq('brand', brand);
                
                const { data: affiliateData, error: affError } = await affQuery;
                
                if (affError) {
                    console.error('Affiliate query error:', affError);
                    // Table might not exist yet - show helpful message
                    if (affError.code === '42P01') {
                        document.getElementById('validationBannerIcon').textContent = '⚠️';
                        document.getElementById('validationBannerTitle').textContent = 'Affiliate Summary Table Not Found';
                        document.getElementById('validationBannerSubtitle').textContent = 'Run the SQL script to create the affiliate_summary table, then upload affiliate data files.';
                        hideLoading('validation');
                        return;
                    }
                }
                
                updateLoadingMessage('validation', 'Aggregating creator performance data...');
                
                // Fetch and aggregate creator performance data with proper pagination
                let allCreatorData = [];
                let page = 0;
                let hasMore = true;
                
                while (hasMore && page < MAX_PAGES) {
                    // Create fresh query for each page
                    let query = supabaseClient
                        .from('creator_performance')
                        .select('report_date, brand, gmv, items_sold, refunds, videos, live_streams, est_commission')
                        .gte('report_date', startStr)
                        .lte('report_date', endStr)
                        .eq('period_type', 'daily')
                        .range(page * QUERY_PAGE_SIZE, (page + 1) * QUERY_PAGE_SIZE - 1);
                    
                    if (brand !== 'all') query = query.eq('brand', brand);
                    
                    const { data: pageData, error: cpError } = await query;
                    
                    if (cpError || !pageData || pageData.length === 0) {
                        hasMore = false;
                    } else {
                        allCreatorData = allCreatorData.concat(pageData);
                        hasMore = pageData.length === QUERY_PAGE_SIZE;
                        page++;
                    }
                }
                
                updateLoadingMessage('validation', 'Computing variances...');
                
                // Aggregate creator data by date + brand
                const creatorAgg = new Map();
                allCreatorData.forEach(row => {
                    const key = `${row.report_date}|${row.brand}`;
                    if (!creatorAgg.has(key)) {
                        creatorAgg.set(key, {
                            report_date: row.report_date,
                            brand: row.brand,
                            gmv: 0,
                            items_sold: 0,
                            refunds: 0,
                            videos: 0,
                            live_streams: 0,
                            est_commission: 0
                        });
                    }
                    const agg = creatorAgg.get(key);
                    agg.gmv += pFloat(row.gmv);
                    agg.items_sold += pInt(row.items_sold);
                    agg.refunds += pFloat(row.refunds);
                    agg.videos += pInt(row.videos);
                    agg.live_streams += pInt(row.live_streams);
                    agg.est_commission += pFloat(row.est_commission);
                });
                
                // Build affiliate lookup
                const affiliateLookup = new Map();
                (affiliateData || []).forEach(row => {
                    const key = `${row.report_date}|${row.brand}`;
                    affiliateLookup.set(key, row);
                });
                
                // Get all unique date+brand combos
                const allKeys = new Set([...creatorAgg.keys(), ...affiliateLookup.keys()]);
                
                // Build validation results
                validationData = [];
                allKeys.forEach(key => {
                    const aff = affiliateLookup.get(key);
                    const cp = creatorAgg.get(key);
                    const [dateStr, brandStr] = key.split('|');
                    
                    const affGmv = aff ? pFloat(aff.gmv) : null;
                    const cpGmv = cp ? cp.gmv : null;
                    const gmvVariance = (cpGmv !== null && affGmv !== null) ? cpGmv - affGmv : null;
                    const gmvVariancePct = (affGmv && affGmv > 0) ? (gmvVariance / affGmv) * 100 : null;
                    
                    // Determine status
                    let status = 'ok';
                    if (!aff) {
                        status = 'missing_affiliate';
                    } else if (!cp) {
                        status = 'missing_creator';
                    } else if (Math.abs(gmvVariancePct) > 5) {
                        status = 'variance';
                    } else if (Math.abs(gmvVariancePct) > 1) {
                        status = 'minor_variance';
                    }
                    
                    validationData.push({
                        report_date: dateStr,
                        brand: brandStr,
                        aff_gmv: affGmv,
                        aff_items: aff ? pInt(aff.items_sold) : null,
                        aff_videos: aff ? pInt(aff.videos) : null,
                        aff_live: aff ? pInt(aff.live_streams) : null,
                        aff_commission: aff ? pFloat(aff.est_commission) : null,
                        cp_gmv: cpGmv,
                        cp_items: cp ? cp.items_sold : null,
                        cp_videos: cp ? cp.videos : null,
                        cp_live: cp ? cp.live_streams : null,
                        cp_commission: cp ? cp.est_commission : null,
                        gmv_variance: gmvVariance,
                        gmv_variance_pct: gmvVariancePct,
                        status: status
                    });
                });
                
                // Sort by date descending
                validationData.sort((a, b) => b.report_date.localeCompare(a.report_date));
                
                // Render results
                renderValidationResults();
                
            } catch (err) {
                console.error('Validation error:', err);
                showToast('Error loading validation data: ' + err.message, 'error');
            } finally {
                hideLoading('validation');
            }
        }
        
        function renderValidationResults() {
            // Calculate summary stats
            const matches = validationData.filter(r => r.status === 'ok').length;
            const mismatches = validationData.filter(r => r.status === 'variance' || r.status === 'minor_variance').length;
            const missingAffiliate = validationData.filter(r => r.status === 'missing_affiliate').length;
            const totalGmvVariance = validationData.reduce((sum, r) => sum + (r.gmv_variance || 0), 0);
            
            // Update stat cards
            document.getElementById('validationMatchCount').textContent = matches;
            document.getElementById('validationMismatchCount').textContent = mismatches;
            document.getElementById('validationTotalGmvVariance').textContent = formatCurrency(Math.abs(totalGmvVariance));
            document.getElementById('validationMissingAffiliate').textContent = missingAffiliate;
            
            // Update banner
            const bannerIcon = document.getElementById('validationBannerIcon');
            const bannerTitle = document.getElementById('validationBannerTitle');
            const bannerSubtitle = document.getElementById('validationBannerSubtitle');
            
            if (validationData.length === 0) {
                bannerIcon.textContent = '📭';
                bannerTitle.textContent = 'No Data Found';
                bannerSubtitle.textContent = 'Upload affiliate data files to enable validation';
            } else if (mismatches === 0 && missingAffiliate === 0) {
                bannerIcon.textContent = '✅';
                bannerTitle.textContent = 'All Data Validated!';
                bannerSubtitle.textContent = `${matches} days of data match between affiliate and creator sources`;
                bannerIcon.parentElement.parentElement.style.background = 'linear-gradient(135deg, var(--success-dim), var(--bg-card))';
            } else if (mismatches > 0) {
                bannerIcon.textContent = '⚠️';
                bannerTitle.textContent = `${mismatches} Discrepancies Found`;
                bannerSubtitle.textContent = `Total GMV variance: ${formatCurrency(totalGmvVariance)} (${totalGmvVariance > 0 ? 'over' : 'under'}-reported)`;
                bannerIcon.parentElement.parentElement.style.background = 'linear-gradient(135deg, var(--warning-dim), var(--bg-card))';
            } else {
                bannerIcon.textContent = '📋';
                bannerTitle.textContent = `${missingAffiliate} Days Missing Affiliate Data`;
                bannerSubtitle.textContent = 'Upload affiliate summary files for complete validation';
                bannerIcon.parentElement.parentElement.style.background = '';
            }
            
            // Render discrepancies section
            const discrepancies = validationData.filter(r => r.status === 'variance' || r.status === 'minor_variance');
            const discrepancySection = document.getElementById('validationDiscrepancies');
            const discrepancyBody = document.getElementById('discrepancyBody');
            
            if (discrepancies.length > 0) {
                discrepancySection.style.display = 'block';
                document.getElementById('discrepancyCount').textContent = discrepancies.length;
                
                discrepancyBody.innerHTML = discrepancies.map(row => `
                    <tr>
                        <td>${row.report_date}</td>
                        <td><span class="brand-pill ${row.brand}">${BRAND_DISPLAY[row.brand] || row.brand}</span></td>
                        <td style="text-align: right; font-family: 'Space Mono', monospace;">${formatCurrency(row.aff_gmv)}</td>
                        <td style="text-align: right; font-family: 'Space Mono', monospace;">${formatCurrency(row.cp_gmv)}</td>
                        <td style="text-align: right; font-family: 'Space Mono', monospace; color: ${row.gmv_variance > 0 ? 'var(--success)' : 'var(--danger)'};">
                            ${row.gmv_variance > 0 ? '+' : ''}${formatCurrency(row.gmv_variance)}
                        </td>
                        <td style="text-align: right; font-family: 'Space Mono', monospace; color: ${row.gmv_variance > 0 ? 'var(--success)' : 'var(--danger)'};">
                            ${row.gmv_variance_pct ? (row.gmv_variance_pct > 0 ? '+' : '') + row.gmv_variance_pct.toFixed(1) + '%' : '--'}
                        </td>
                        <td>${getValidationStatusBadge(row.status)}</td>
                    </tr>
                `).join('');
            } else {
                discrepancySection.style.display = 'none';
            }
            
            // Render full table
            filterValidationTable();
        }
        
        function filterValidationTable() {
            const showOnlyDiscrepancies = document.getElementById('showOnlyDiscrepancies').checked;
            const tbody = document.getElementById('validationTableBody');
            
            let filtered = validationData;
            if (showOnlyDiscrepancies) {
                filtered = validationData.filter(r => r.status !== 'ok');
            }
            
            if (filtered.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="12" style="text-align: center; padding: 40px; color: var(--text-muted);">
                            ${showOnlyDiscrepancies ? 'No discrepancies found! 🎉' : 'No validation data available'}
                        </td>
                    </tr>
                `;
                return;
            }
            
            tbody.innerHTML = filtered.map(row => `
                <tr class="clickable ${row.status === 'variance' ? 'row-warning' : row.status === 'missing_affiliate' ? 'row-muted' : ''}" onclick="openValidationDrilldown('${row.report_date}', '${row.brand}')">
                    <td>${row.report_date}</td>
                    <td><span class="brand-pill ${row.brand}">${BRAND_DISPLAY[row.brand] || row.brand}</span></td>
                    <td style="text-align: right; font-family: 'Space Mono', monospace;">${row.aff_gmv !== null ? formatCurrency(row.aff_gmv) : '<span style="color: var(--text-muted);">--</span>'}</td>
                    <td style="text-align: right; font-family: 'Space Mono', monospace;">${row.cp_gmv !== null ? formatCurrency(row.cp_gmv) : '<span style="color: var(--text-muted);">--</span>'}</td>
                    <td style="text-align: right; font-family: 'Space Mono', monospace; color: ${getVarianceColor(row.gmv_variance_pct)};">
                        ${row.gmv_variance !== null ? (row.gmv_variance > 0 ? '+' : '') + formatCurrency(row.gmv_variance) : '--'}
                    </td>
                    <td style="text-align: right; font-family: 'Space Mono', monospace;">${row.aff_items !== null ? row.aff_items.toLocaleString() : '--'}</td>
                    <td style="text-align: right; font-family: 'Space Mono', monospace;">${row.cp_items !== null ? row.cp_items.toLocaleString() : '--'}</td>
                    <td style="text-align: right; font-family: 'Space Mono', monospace;">${row.aff_videos !== null ? row.aff_videos.toLocaleString() : '--'}</td>
                    <td style="text-align: right; font-family: 'Space Mono', monospace;">${row.cp_videos !== null ? row.cp_videos.toLocaleString() : '--'}</td>
                    <td style="text-align: right; font-family: 'Space Mono', monospace;">${row.aff_commission !== null ? formatCurrency(row.aff_commission) : '--'}</td>
                    <td style="text-align: right; font-family: 'Space Mono', monospace;">${row.cp_commission !== null ? formatCurrency(row.cp_commission) : '--'}</td>
                    <td>${getValidationStatusBadge(row.status)}</td>
                </tr>
            `).join('');
        }
        
        function getValidationStatusBadge(status) {
            const badges = {
                'ok': '<span class="badge" style="background: var(--success-dim); color: var(--success);">✓ Match</span>',
                'minor_variance': '<span class="badge" style="background: var(--warning-dim); color: var(--warning);">~ Minor</span>',
                'variance': '<span class="badge" style="background: var(--danger-dim); color: var(--danger);">⚠ Variance</span>',
                'missing_affiliate': '<span class="badge" style="background: var(--bg-secondary); color: var(--text-muted);">No Affiliate</span>',
                'missing_creator': '<span class="badge" style="background: var(--blue-dim); color: var(--blue);">No Creator</span>'
            };
            return badges[status] || status;
        }
        
        function getVarianceColor(pct) {
            if (pct === null) return 'var(--text-muted)';
            if (Math.abs(pct) <= 1) return 'var(--success)';
            if (Math.abs(pct) <= 5) return 'var(--warning)';
            return 'var(--danger)';
        }
        
        // ==================== BRAND MISMATCH SCANNER ====================
        async function runBrandMismatchScan() {
            const resultsDiv = document.getElementById('brandMismatchResults');
            resultsDiv.innerHTML = `
                <div style="text-align: center; padding: 40px; color: var(--text-muted);">
                    <div class="spinner-ring spinner-ring-active" style="width: 40px; height: 40px; margin: 0 auto 16px;"></div>
                    Scanning for brand mismatches...<br>
                    <span style="font-size: 0.8rem;">Checking videos against creator brands</span>
                </div>
            `;
            
            // Brand keyword patterns for mismatch detection
            const brandKeywords = {
                'physicians_choice': ['physicians choice', "physician's choice", 'pc probiotic', 'digestive enzyme', 'probiotic', '60 billion'],
                'catakor': ['cata-kor', 'catakor', 'cata kor'],
                'yerba_magic': ['yerba magic', 'yerba', 'mate energy'],
                'jiyu': ['jiyu', 'ji-yu', 'ji yu', 'collagen'],
                'peach_slices': ['peach slices', 'peach slice', 'acne spot', 'acne patches']
            };
            
            try {
                // Get all recent videos with creator info
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                const startDate = localDateStr(thirtyDaysAgo);
                
                let allVideos = [];
                let page = 0;
                let hasMore = true;
                
                while (hasMore && page < 10) {
                    const { data, error } = await supabaseClient
                        .from('video_performance')
                        .select('creator_name, brand, video_title, product_name, video_id, gmv')
                        .gte('report_date', startDate)
                        .range(page * 2000, (page + 1) * 2000 - 1);
                    
                    if (error || !data || data.length === 0) {
                        hasMore = false;
                    } else {
                        allVideos = allVideos.concat(data);
                        hasMore = data.length === 2000;
                        page++;
                    }
                }
                
                // Dedupe videos by video_id + creator
                const videoMap = new Map();
                allVideos.forEach(v => {
                    const key = `${v.video_id}-${v.creator_name}-${v.brand}`;
                    if (!videoMap.has(key)) {
                        videoMap.set(key, { ...v, totalGmv: pFloat(v.gmv) });
                    } else {
                        videoMap.get(key).totalGmv += pFloat(v.gmv);
                    }
                });
                
                // Find mismatches
                const mismatches = [];
                
                function detectLikelyBrand(videoTitle, productName) {
                    const searchText = ((videoTitle || '') + ' ' + (productName || '')).toLowerCase();
                    for (const [brandKey, keywords] of Object.entries(brandKeywords)) {
                        for (const kw of keywords) {
                            if (searchText.includes(kw)) {
                                return brandKey;
                            }
                        }
                    }
                    return null;
                }
                
                videoMap.forEach(v => {
                    const likelyBrand = detectLikelyBrand(v.video_title, v.product_name);
                    if (likelyBrand && likelyBrand !== v.brand) {
                        mismatches.push({
                            creator_name: v.creator_name,
                            tagged_brand: v.brand,
                            likely_brand: likelyBrand,
                            video_title: v.video_title,
                            video_id: v.video_id,
                            gmv: v.totalGmv
                        });
                    }
                });
                
                // Group by creator + brand combo
                const creatorMismatches = new Map();
                mismatches.forEach(m => {
                    const key = `${m.creator_name}-${m.tagged_brand}`;
                    if (!creatorMismatches.has(key)) {
                        creatorMismatches.set(key, {
                            creator_name: m.creator_name,
                            tagged_brand: m.tagged_brand,
                            likely_brand: m.likely_brand,
                            video_count: 0,
                            total_gmv: 0,
                            sample_title: m.video_title
                        });
                    }
                    const c = creatorMismatches.get(key);
                    c.video_count++;
                    c.total_gmv += m.gmv;
                });
                
                const creatorList = [...creatorMismatches.values()].sort((a, b) => b.total_gmv - a.total_gmv);
                
                // Render results
                if (creatorList.length === 0) {
                    resultsDiv.innerHTML = `
                        <div style="text-align: center; padding: 40px; color: var(--success);">
                            <div style="font-size: 2rem; margin-bottom: 12px;">✅</div>
                            <p style="font-weight: 600;">No Brand Mismatches Found!</p>
                            <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 8px;">
                                All videos appear to match their creators' assigned brands.
                            </p>
                        </div>
                    `;
                } else {
                    resultsDiv.innerHTML = `
                        <div style="margin-bottom: 16px; padding: 12px; background: var(--warning-dim); border-radius: 8px; display: flex; align-items: center; gap: 12px;">
                            <span style="font-size: 1.5rem;">⚠️</span>
                            <div>
                                <strong style="color: var(--warning);">Found ${creatorList.length} potential mismatches</strong>
                                <div style="font-size: 0.85rem; color: var(--text-muted);">
                                    These creators have videos that appear to belong to a different brand than they're tagged under.
                                </div>
                            </div>
                        </div>
                        <div style="max-height: 400px; overflow-y: auto;">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Creator</th>
                                        <th>Tagged As</th>
                                        <th>Likely Brand</th>
                                        <th style="text-align: right;">Videos</th>
                                        <th style="text-align: right;">GMV</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${creatorList.map(c => `
                                        <tr>
                                            <td>
                                                <strong style="cursor: pointer;" onclick="openCreatorDetail('${c.creator_name.replace(/'/g, "\\'")}', '${c.tagged_brand}')">${c.creator_name}</strong>
                                                <div style="font-size: 0.75rem; color: var(--text-muted); max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${c.sample_title || ''}</div>
                                            </td>
                                            <td><span class="brand-pill ${c.tagged_brand}">${BRAND_DISPLAY[c.tagged_brand] || c.tagged_brand}</span></td>
                                            <td><span class="brand-pill ${c.likely_brand}">${BRAND_DISPLAY[c.likely_brand] || c.likely_brand}</span></td>
                                            <td style="text-align: right;">${c.video_count}</td>
                                            <td style="text-align: right; font-family: 'Space Mono', monospace;">${formatCurrency(c.total_gmv)}</td>
                                            <td>
                                                <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 0.75rem;" onclick="quickFixBrand('${c.creator_name.replace(/'/g, "\\'")}', '${c.tagged_brand}', '${c.likely_brand}')">
                                                    🔄 Fix
                                                </button>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    `;
                }
                
            } catch (err) {
                console.error('Brand mismatch scan error:', err);
                resultsDiv.innerHTML = `
                    <div style="text-align: center; padding: 40px; color: var(--danger);">
                        <div style="font-size: 2rem; margin-bottom: 12px;">❌</div>
                        <p>Error scanning for mismatches: ${err.message}</p>
                    </div>
                `;
            }
        }
        
        async function quickFixBrand(creatorName, oldBrand, newBrand) {
            if (!confirm(`Change ${creatorName} from ${BRAND_DISPLAY[oldBrand]} to ${BRAND_DISPLAY[newBrand]}?`)) {
                return;
            }
            
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
                
                showToast(`✅ Changed ${creatorName} to ${BRAND_DISPLAY[newBrand]}`, 'success');
                
                // Re-run scan to update list
                runBrandMismatchScan();
                
            } catch (err) {
                console.error('Quick fix brand error:', err);
                showToast(`Error: ${err.message}`, 'error');
            }
        }
        
        // ==================== VALIDATION DRILL-DOWN ====================
        async function openValidationDrilldown(reportDate, brand) {
            const modal = document.getElementById('validationDrilldownModal');
            const title = document.getElementById('drilldownTitle');
            const body = document.getElementById('drilldownBody');
            
            title.textContent = `${BRAND_DISPLAY[brand] || brand} - ${reportDate}`;
            body.innerHTML = `
                <div style="text-align: center; padding: 40px; color: var(--text-muted);">
                    <div class="spinner-ring spinner-ring-active" style="width: 40px; height: 40px; margin: 0 auto 16px;"></div>
                    Loading creator data...
                </div>
            `;
            modal.classList.add('show');
            
            try {
                // Get affiliate summary for this date/brand
                const { data: affData } = await supabaseClient
                    .from('affiliate_summary')
                    .select('*')
                    .eq('report_date', reportDate)
                    .eq('brand', brand)
                    .single();
                
                console.log('Drilldown query params:', { reportDate, brand });
                
                // Get all creators for this date/brand with pagination
                let allCreators = [];
                let page = 0;
                let hasMore = true;
                
                while (hasMore && page < 20) {
                    const { data: pageData, error } = await supabaseClient
                        .from('creator_performance')
                        .select('creator_name, gmv, items_sold, videos, live_streams, est_commission')
                        .eq('report_date', reportDate)
                        .eq('brand', brand)
                        .eq('period_type', 'daily')
                        .order('gmv', { ascending: false })
                        .range(page * 1000, (page + 1) * 1000 - 1);
                    
                    if (error) {
                        console.error('Drilldown query error:', error);
                    }
                    console.log('Drilldown page', page, 'results:', pageData?.length || 0);
                    
                    if (error || !pageData || pageData.length === 0) {
                        hasMore = false;
                    } else {
                        allCreators = allCreators.concat(pageData);
                        hasMore = pageData.length === 1000;
                        page++;
                    }
                }
                
                console.log('Total creators found:', allCreators.length);
                
                // Debug: If no creators found, check what brands exist for this date
                if (allCreators.length === 0) {
                    const { data: debugData } = await supabaseClient
                        .from('creator_performance')
                        .select('brand, report_date')
                        .eq('report_date', reportDate)
                        .eq('period_type', 'daily')
                        .limit(10);
                    console.log('Debug - brands found for date', reportDate, ':', debugData?.map(d => d.brand));
                }
                
                // Calculate totals from creator data
                const cpTotals = {
                    gmv: allCreators.reduce((sum, c) => sum + pFloat(c.gmv), 0),
                    items_sold: allCreators.reduce((sum, c) => sum + pInt(c.items_sold), 0),
                    videos: allCreators.reduce((sum, c) => sum + pInt(c.videos), 0),
                    live_streams: allCreators.reduce((sum, c) => sum + pInt(c.live_streams), 0),
                    est_commission: allCreators.reduce((sum, c) => sum + pFloat(c.est_commission), 0),
                    creator_count: allCreators.length
                };
                
                // Calculate variances
                const gmvVariance = affData ? cpTotals.gmv - pFloat(affData.gmv) : null;
                const itemsVariance = affData ? cpTotals.items_sold - pInt(affData.items_sold) : null;
                const videosVariance = affData ? cpTotals.videos - pInt(affData.videos) : null;
                const commVariance = affData ? cpTotals.est_commission - pFloat(affData.est_commission) : null;
                
                // Build the drilldown HTML
                body.innerHTML = `
                    <!-- Summary Comparison -->
                    <div class="card" style="margin-bottom: 24px;">
                        <div class="card-header">
                            <div class="card-title"><span>📊</span> Summary Comparison</div>
                        </div>
                        <div class="card-body" style="padding: 0;">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Metric</th>
                                        <th style="text-align: right;">Affiliate (Source)</th>
                                        <th style="text-align: right;">Creator Data</th>
                                        <th style="text-align: right;">Variance</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td><strong>GMV</strong></td>
                                        <td style="text-align: right; font-family: 'Space Mono', monospace;">${affData ? formatCurrency(affData.gmv) : '--'}</td>
                                        <td style="text-align: right; font-family: 'Space Mono', monospace;">${formatCurrency(cpTotals.gmv)}</td>
                                        <td style="text-align: right; font-family: 'Space Mono', monospace; color: ${gmvVariance && Math.abs(gmvVariance) > 1 ? (gmvVariance > 0 ? 'var(--success)' : 'var(--danger)') : 'var(--text-muted)'};">
                                            ${gmvVariance !== null ? (gmvVariance >= 0 ? '+' : '') + formatCurrency(gmvVariance) : '--'}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td><strong>Items Sold</strong></td>
                                        <td style="text-align: right; font-family: 'Space Mono', monospace;">${affData ? pInt(affData.items_sold).toLocaleString() : '--'}</td>
                                        <td style="text-align: right; font-family: 'Space Mono', monospace;">${cpTotals.items_sold.toLocaleString()}</td>
                                        <td style="text-align: right; font-family: 'Space Mono', monospace; color: ${itemsVariance && Math.abs(itemsVariance) > 0 ? (itemsVariance > 0 ? 'var(--success)' : 'var(--danger)') : 'var(--text-muted)'};">
                                            ${itemsVariance !== null ? (itemsVariance >= 0 ? '+' : '') + itemsVariance.toLocaleString() : '--'}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td><strong>Videos</strong></td>
                                        <td style="text-align: right; font-family: 'Space Mono', monospace;">${affData ? pInt(affData.videos).toLocaleString() : '--'}</td>
                                        <td style="text-align: right; font-family: 'Space Mono', monospace;">${cpTotals.videos.toLocaleString()}</td>
                                        <td style="text-align: right; font-family: 'Space Mono', monospace; color: ${videosVariance && Math.abs(videosVariance) > 0 ? (videosVariance > 0 ? 'var(--success)' : 'var(--danger)') : 'var(--text-muted)'};">
                                            ${videosVariance !== null ? (videosVariance >= 0 ? '+' : '') + videosVariance.toLocaleString() : '--'}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td><strong>Commission</strong></td>
                                        <td style="text-align: right; font-family: 'Space Mono', monospace;">${affData ? formatCurrency(affData.est_commission) : '--'}</td>
                                        <td style="text-align: right; font-family: 'Space Mono', monospace;">${formatCurrency(cpTotals.est_commission)}</td>
                                        <td style="text-align: right; font-family: 'Space Mono', monospace; color: ${commVariance && Math.abs(commVariance) > 1 ? (commVariance > 0 ? 'var(--success)' : 'var(--danger)') : 'var(--text-muted)'};">
                                            ${commVariance !== null ? (commVariance >= 0 ? '+' : '') + formatCurrency(commVariance) : '--'}
                                        </td>
                                    </tr>
                                    <tr style="background: var(--bg-secondary);">
                                        <td><strong>Creators in Data</strong></td>
                                        <td style="text-align: right; font-family: 'Space Mono', monospace; color: var(--text-muted);">--</td>
                                        <td style="text-align: right; font-family: 'Space Mono', monospace;">${cpTotals.creator_count.toLocaleString()}</td>
                                        <td style="text-align: right; color: var(--text-muted);">--</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                    
                    ${gmvVariance && gmvVariance < 0 ? `
                    <div class="card" style="margin-bottom: 24px; border-left: 4px solid var(--warning);">
                        <div class="card-body">
                            <div style="display: flex; align-items: center; gap: 12px;">
                                <span style="font-size: 1.5rem;">⚠️</span>
                                <div>
                                    <div style="font-weight: 600; color: var(--warning);">Creator data is ${formatCurrency(Math.abs(gmvVariance))} under affiliate total</div>
                                    <div style="color: var(--text-muted); font-size: 0.85rem; margin-top: 4px;">
                                        This usually means some creators are missing from the uploaded data. Check TikTok Shop for creators not in the list below.
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    ` : ''}
                    
                    <!-- Creator Breakdown -->
                    <div class="card">
                        <div class="card-header">
                            <div class="card-title"><span>👥</span> Creator Breakdown (${allCreators.length} creators)</div>
                            <input type="text" id="drilldownSearch" placeholder="Search creators..." 
                                   style="padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-primary); color: var(--text-primary); width: 200px;"
                                   oninput="filterDrilldownTable(this.value)">
                        </div>
                        <div class="card-body" style="padding: 0; max-height: 400px; overflow-y: auto;">
                            <table>
                                <thead style="position: sticky; top: 0; z-index: 10;">
                                    <tr>
                                        <th>#</th>
                                        <th>Creator</th>
                                        <th style="text-align: right;">GMV</th>
                                        <th style="text-align: right;">Items</th>
                                        <th style="text-align: right;">Videos</th>
                                        <th style="text-align: right;">Commission</th>
                                        <th style="text-align: right;">% of Total</th>
                                    </tr>
                                </thead>
                                <tbody id="drilldownCreatorTable">
                                    ${allCreators.length === 0 ? `
                                        <tr><td colspan="7" style="text-align: center; padding: 40px; color: var(--text-muted);">No creator data found</td></tr>
                                    ` : allCreators.map((c, i) => `
                                        <tr class="drilldown-row" data-name="${(c.creator_name || '').toLowerCase()}">
                                            <td style="color: var(--text-muted);">${i + 1}</td>
                                            <td><strong>${c.creator_name || 'Unknown'}</strong></td>
                                            <td style="text-align: right; font-family: 'Space Mono', monospace;">${formatCurrency(c.gmv)}</td>
                                            <td style="text-align: right; font-family: 'Space Mono', monospace;">${pInt(c.items_sold).toLocaleString()}</td>
                                            <td style="text-align: right; font-family: 'Space Mono', monospace;">${pInt(c.videos).toLocaleString()}</td>
                                            <td style="text-align: right; font-family: 'Space Mono', monospace;">${formatCurrency(c.est_commission)}</td>
                                            <td style="text-align: right; font-family: 'Space Mono', monospace; color: var(--text-muted);">
                                                ${cpTotals.gmv > 0 ? ((pFloat(c.gmv) / cpTotals.gmv) * 100).toFixed(1) + '%' : '--'}
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                `;
                
            } catch (err) {
                console.error('Drilldown error:', err);
                body.innerHTML = `
                    <div style="text-align: center; padding: 40px; color: var(--danger);">
                        Error loading data: ${err.message}
                    </div>
                `;
            }
        }
        
        function filterDrilldownTable(searchTerm) {
            const rows = document.querySelectorAll('.drilldown-row');
            const term = searchTerm.toLowerCase();
            rows.forEach(row => {
                const name = row.dataset.name || '';
                row.style.display = name.includes(term) ? '' : 'none';
            });
        }
        
        function closeValidationDrilldown() {
            document.getElementById('validationDrilldownModal').classList.remove('show');
        }

        // ==================== SYSTEM STATUS ====================
        let connectionHealthy = false;
        let lastDataDate = null;
        
        async function checkConnectionHealth() {
            const dot = document.getElementById('connectionDot');
            const text = document.getElementById('connectionText');
            if (!dot || !text) return;
            
            try {
                const start = Date.now();
                const { data, error } = await supabaseClient.from('video_performance').select('report_date').limit(1);
                const latency = Date.now() - start;
                
                if (error) throw error;
                
                connectionHealthy = true;
                dot.className = 'status-dot connected';
                text.textContent = latency < 500 ? 'Connected' : `Connected (${latency}ms)`;
                
            } catch (err) {
                connectionHealthy = false;
                dot.className = 'status-dot disconnected';
                text.textContent = 'Disconnected';
                console.error('Connection check failed:', err);
            }
        }
        
        async function updateDataFreshness() {
            const freshnessEl = document.getElementById('dataFreshness');
            if (!freshnessEl) return;
            
            try {
                const { data, error } = await supabaseClient
                    .from('video_performance')
                    .select('report_date')
                    .order('report_date', { ascending: false })
                    .limit(1);
                
                if (error || !data || data.length === 0) {
                    freshnessEl.textContent = 'No data';
                    freshnessEl.className = 'status-value old';
                    return;
                }
                
                lastDataDate = new Date(data[0].report_date + 'T00:00:00');
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const diffDays = Math.floor((today - lastDataDate) / (1000 * 60 * 60 * 24));
                
                const dateStr = lastDataDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                
                if (diffDays <= 1) {
                    freshnessEl.textContent = dateStr + ' ✓';
                    freshnessEl.className = 'status-value fresh';
                } else if (diffDays <= 3) {
                    freshnessEl.textContent = dateStr + ` (${diffDays}d ago)`;
                    freshnessEl.className = 'status-value stale';
                } else {
                    freshnessEl.textContent = dateStr + ` (${diffDays}d ago!)`;
                    freshnessEl.className = 'status-value old';
                }
                
            } catch (err) {
                freshnessEl.textContent = 'Error';
                freshnessEl.className = 'status-value old';
                console.error('Data freshness check failed:', err);
            }
        }
        
        async function initSystemStatus() {
            await checkConnectionHealth();
            await updateDataFreshness();
            
            // Check connection health every 30 seconds
            setInterval(checkConnectionHealth, 30000);
            // Update data freshness every 5 minutes
            setInterval(updateDataFreshness, 300000);
        }

        // Initialize
        async function init() {
            console.log('=== INIT STARTING ===');
            try {
                populateBrandDropdowns();
                console.log('Brand dropdowns populated');
                
                setupNavigation(); // Setup nav FIRST so it always works
                console.log('Navigation setup complete');
                
                // Move Overview content into Ops Center Overview tab
                const viewOverview = document.getElementById('view-overview');
                const opsOverview = document.getElementById('ops-tab-overview');
                if (viewOverview && opsOverview) {
                    // Move all children instead of copying innerHTML to preserve canvas references
                    while (viewOverview.firstChild) {
                        opsOverview.appendChild(viewOverview.firstChild);
                    }
                    viewOverview.style.display = 'none';
                }
                
                // Initialize system status (connection + data freshness)
                initSystemStatus();
                
                await loadManagedCreators().catch(e => console.warn('Could not load managed creators:', e));
                await loadAvailableDates().catch(e => console.warn('Could not load dates:', e));
                await loadDataHealth().catch(e => console.warn('Could not load data health:', e));
                
                // Default to Ops Center with Overview tab
                switchView('opscenter');
                
                loadOverviewData();
                opsData.overviewLoaded = true;
                
                loadAlertsData(); // Load alerts for bell notification
                loadApplicationSettings(); // Load application page settings
                updatePendingUsersBadge(); // Update pending users badge
                updateLastUpdated();
                generateAutoAlerts();
                console.log('=== INIT COMPLETE ===');
            } catch (error) {
                console.error('Init error:', error);
            }
        }

        function setupNavigation() {
            // Navigation handled by inline onclick handlers
            console.log('Navigation ready');
        }

        // Make switchView global for inline onclick handlers
        window.switchView = function(view) {
            // Check role-based access
            if (window.currentUserRole && typeof canAccessView === 'function' && !canAccessView(view)) {
                showToast('Access denied for this section', 'error');
                return;
            }
            
            console.log('Switching to view:', view);
            currentView = view;
            
            // Auto-expand settings nav if needed
            const settingsViews = ['settings', 'goals', 'activity', 'datastatus'];
            if (settingsViews.includes(view)) {
                const group = document.getElementById('settingsNavGroup');
                const arrow = document.getElementById('settingsNavArrow');
                if (group && !group.classList.contains('expanded')) {
                    group.classList.add('expanded');
                    if (arrow) arrow.style.transform = 'rotate(180deg)';
                }
            }
            
            // Update active nav item (sidebar)
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            const activeNav = document.querySelector(`.nav-item[data-view="${view}"]`);
            if (activeNav) activeNav.classList.add('active');
            
            // Update mobile bottom nav
            document.querySelectorAll('.mobile-nav-item').forEach(i => i.classList.remove('active'));
            const mobileViews = ['overview', 'creators', 'brands', 'videos'];
            if (mobileViews.includes(view)) {
                const mobileNav = document.querySelector(`.mobile-nav-item[onclick*="${view}"]`);
                if (mobileNav) mobileNav.classList.add('active');
            }
            
            // Update active view section
            document.querySelectorAll('.view-section').forEach(s => {
                s.classList.remove('active');
                s.style.display = 'none';
            });
            const viewEl = document.getElementById(`view-${view}`);
            if (viewEl) {
                viewEl.classList.add('active');
                viewEl.style.display = 'block';
                console.log('View switched successfully');
            } else {
                console.error('View not found:', `view-${view}`);
            }
            
            loadViewData();
            closeMobileMenu();
        }
        
        // Process any view that was clicked before script loaded
        if (window._pendingView) {
            console.log('Processing pending view:', window._pendingView);
            window.switchView(window._pendingView);
            delete window._pendingView;
        }

        function loadViewData(forceRefresh = false) {
            // If force refresh, clear cache for this view
            if (forceRefresh) {
                cache.invalidate(currentView);
                viewsLoaded.delete(currentView);
            }
            
            switch(currentView) {
                case 'opscenter': lazyLoadView('opscenter', loadVideosTab, forceRefresh); break;
                case 'dailyops': lazyLoadView('dailyops', loadDailyOps, forceRefresh); break;
                case 'weeklyops': lazyLoadView('weeklyops', loadWeeklyOps, forceRefresh); break;
                case 'overview': loadOverviewData(); break; // Always refresh overview
                case 'brands': 
                    loadAllProductsForFilter('brandsProductFilter');
                    lazyLoadView('brands', loadBrandsData, forceRefresh); 
                    break;
                case 'creators': lazyLoadView('creators', loadCreatorsData, forceRefresh); break;
                case 'videos': lazyLoadView('videos', loadVideosData, forceRefresh); break;
                case 'products': lazyLoadView('products', loadProductsData, forceRefresh); break;
                case 'roster': lazyLoadView('roster', loadRosterData, forceRefresh); break;
                case 'goals': lazyLoadView('goals', loadGoalsData, forceRefresh); break;
                case 'alerts': loadAlertsData(); break;
                case 'calculator': initCalculator().then(() => calculateRevenueShare()); break;
                case 'funnels': loadFunnelsData(); break;
                case 'settings': loadDiscordSettings(); loadEmailSmsSettings(); loadApplicationSettings(); settingsProductsLoaded = true; loadSettingsProducts(); loadProductGroups(); break;
                case 'datastatus': loadDataHealth(); break;
                case 'applications': lazyLoadView('applications', loadApplicationsData, forceRefresh); break;
                case 'users': lazyLoadView('users', loadUsersData, forceRefresh); break;
                case 'payments': lazyLoadView('payments', loadPaymentsData, forceRefresh); break;
                case 'commissions': lazyLoadView('commissions', loadCommissionsData, forceRefresh); break;
                case 'activity': lazyLoadView('activity', loadActivityLog, forceRefresh); break;
                case 'portalconfig': loadCampaigns(); break;
            }
            updateLastUpdated();
        }
        
        // Data Status tab switching
        let currentDataStatusTab = 'uploads';
        
        function switchDataStatusTab(tab) {
            currentDataStatusTab = tab;
            
            // Update tab buttons
            document.getElementById('tab-uploads').classList.toggle('active', tab === 'uploads');
            document.getElementById('tab-validation').classList.toggle('active', tab === 'validation');
            
            // Update tab content
            document.getElementById('datastatus-uploads').style.display = tab === 'uploads' ? 'block' : 'none';
            document.getElementById('datastatus-validation').style.display = tab === 'validation' ? 'block' : 'none';
            
            // Load data for the active tab
            if (tab === 'uploads') {
                loadDataHealth();
            } else if (tab === 'validation') {
                loadValidationData();
            }
        }
        
        function refreshDataStatusTab() {
            if (currentDataStatusTab === 'uploads') {
                loadDataHealth();
            } else {
                loadValidationData();
            }
            showToast('Data refreshed!', 'success');
        }
        
        // Force refresh current view (called by Refresh buttons)
        function refreshCurrentView() {
            loadViewData(true);
            showToast('Data refreshed!', 'success');
        }
        
        // Scroll to Top
        function scrollToTop() {
            const mainContent = document.querySelector('.main-content');
            if (mainContent) {
                mainContent.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }
        
        // Show/hide scroll to top button based on scroll position
        function initScrollToTop() {
            const mainContent = document.querySelector('.main-content');
            const scrollBtn = document.getElementById('scrollToTop');
            
            if (mainContent && scrollBtn) {
                mainContent.addEventListener('scroll', () => {
                    if (mainContent.scrollTop > 300) {
                        scrollBtn.classList.add('visible');
                    } else {
                        scrollBtn.classList.remove('visible');
                    }
                });
            }
        }
        
        // Initialize scroll listener after DOM loads
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(initScrollToTop, 100);
        });

        async function loadManagedCreators() {
            return dedupedFetch('managed_creators', async () => {
                const { data } = await supabaseClient.from('managed_creators')
                    .select('*')
                    .order('id', { ascending: true });
                managedCreators = data || [];
                return managedCreators;
            });
        }

        async function loadAvailableDates() {
            return dedupedFetch('available_dates', async () => {
                // Try RPC function first, fall back to direct query
                let dateData = null;
                
                const { data: rpcData, error: rpcError } = await supabaseClient.rpc('get_available_dates');
                
                if (rpcError) {
                    console.warn('RPC function not available, using fallback query');
                    // Fallback: direct query for dates
                    const { data: fallbackData } = await supabaseClient
                        .from('creator_performance')
                        .select('report_date, period_type')
                        .eq('period_type', 'daily')
                        .order('report_date', { ascending: false })
                        .limit(365);
                    dateData = fallbackData;
                } else {
                    dateData = rpcData;
                }

                // Only use daily dates
                const dailySet = new Set();
                
                (dateData || []).forEach(d => {
                    if (d.period_type === 'daily') {
                        dailySet.add(d.report_date);
                    }
                });

                availableDates = { 
                    daily: [...dailySet].sort().reverse()
                };
                
                console.log('Available dates:', availableDates.daily?.length || 0, 'days loaded');
                populateDateFilters();
                return availableDates;
            });
        }

        // Store Litepicker instances
        const datePickers = {};
        
        function populateDateFilters() {
            const dates = availableDates.daily || [];
            if (!dates || dates.length === 0) return;
            
            // Get min and max dates for the calendar range
            const sortedDates = [...dates].sort();
            const minDate = sortedDates[0];
            const maxDate = sortedDates[sortedDates.length - 1];
            
            // Create a Set of available dates for quick lookup
            const availableDateSet = new Set(dates);
            
            // Most recent date with data as default (smart default)
            const latestDateStr = maxDate; // Most recent date with data
            const latestDate = new Date(latestDateStr + 'T12:00:00');
            
            // Also calculate yesterday for comparison
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            yesterday.setHours(0, 0, 0, 0);
            const yesterdayStr = localDateStr(yesterday);
            
            // Helper to create date at midnight
            const makeDate = (daysAgo) => {
                const d = new Date();
                d.setDate(d.getDate() - daysAgo);
                d.setHours(0, 0, 0, 0);
                return d;
            };
            
            // Create preset ranges (all ending at latest available data) - must be Date objects
            const last7Start = new Date(latestDate);
            last7Start.setDate(last7Start.getDate() - 6);
            const last14Start = new Date(latestDate);
            last14Start.setDate(last14Start.getDate() - 13);
            const last30Start = new Date(latestDate);
            last30Start.setDate(last30Start.getDate() - 29);
            const thisMonthStart = new Date(latestDate.getFullYear(), latestDate.getMonth(), 1);
            const lastMonthStart = new Date(latestDate.getFullYear(), latestDate.getMonth() - 1, 1);
            const lastMonthEnd = new Date(latestDate.getFullYear(), latestDate.getMonth(), 0);
            
            const presetRanges = {
                'Latest Day': [new Date(latestDate), new Date(latestDate)],
                'Last 7 Days': [last7Start, new Date(latestDate)],
                'Last 14 Days': [last14Start, new Date(latestDate)],
                'Last 30 Days': [last30Start, new Date(latestDate)],
                'This Month': [thisMonthStart, new Date(latestDate)],
                'Last Month': [lastMonthStart, lastMonthEnd]
            };
            
            // Flag to prevent dropdown from switching to "custom" when preset is being applied
            let applyingPreset = false;
            
            // Initialize Overview date picker
            const overviewEl = document.getElementById('overviewDateRange');
            const startHidden = document.getElementById('dateFilterStart');
            const endHidden = document.getElementById('dateFilterEnd');
            const presetSelect = document.getElementById('datePresetSelect');
            
            // Helper to convert Litepicker DateTime to YYYY-MM-DD string
            const toDateStr = (lpDate) => lpDate.format('YYYY-MM-DD');
            
            if (overviewEl && startHidden && endHidden) {
                // Set initial values to Last 7 Days of available data
                startHidden.value = localDateStr(last7Start);
                endHidden.value = latestDateStr;
                
                const overviewPicker = new Litepicker({
                    element: overviewEl,
                    singleMode: false,
                    numberOfMonths: 2,
                    numberOfColumns: 2,
                    firstDay: 0, // Sunday
                    minDate: minDate,
                    maxDate: maxDate,
                    startDate: last7Start,
                    endDate: latestDate,
                    format: 'MMM D, YYYY',
                    delimiter: ' → ',
                    autoApply: true,
                    showTooltip: true,
                    tooltipText: { one: 'day', other: 'days' },
                    lockDaysFilter: (date) => !availableDateSet.has(toDateStr(date)),
                    setup: (picker) => {
                        picker.on('selected', (date1, date2) => {
                            if (date1 && date2) {
                                startHidden.value = toDateStr(date1);
                                endHidden.value = toDateStr(date2);
                                // Set dropdown to custom when manually selecting (not from preset)
                                if (!applyingPreset && presetSelect) presetSelect.value = 'custom';
                                loadOverviewData();
                            }
                        });
                    }
                });
                
                datePickers['overview'] = overviewPicker;
                
                // Handle preset dropdown change
                if (presetSelect) {
                    presetSelect.addEventListener('change', function() {
                        const val = this.value;
                        let range = null;
                        
                        switch(val) {
                            case 'yesterday':
                                range = presetRanges['Yesterday'];
                                break;
                            case 'last7':
                                range = presetRanges['Last 7 Days'];
                                break;
                            case 'last14':
                                range = presetRanges['Last 14 Days'];
                                break;
                            case 'last30':
                                range = presetRanges['Last 30 Days'];
                                break;
                            case 'thisMonth':
                                range = presetRanges['This Month'];
                                break;
                            case 'lastMonth':
                                range = presetRanges['Last Month'];
                                break;
                            case 'custom':
                                // Just open the picker
                                overviewPicker.show();
                                return;
                        }
                        
                        if (range && range[0] && range[1]) {
                            applyingPreset = true;
                            overviewPicker.setDateRange(range[0], range[1]);
                            applyingPreset = false;
                            startHidden.value = localDateStr(range[0]);
                            endHidden.value = localDateStr(range[1]);
                            
                            // Update input field display
                            const formatDisplayDate = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                            overviewEl.value = `${formatDisplayDate(range[0])} → ${formatDisplayDate(range[1])}`;
                            
                            loadOverviewData();
                        }
                    });
                }
            }
            
            // Trigger initial data load
            setTimeout(() => loadOverviewData(), 100);
            
            // Initialize Daily Ops date picker (single date)
            const dailyDateEl = document.getElementById('dailyDatePicker');
            if (dailyDateEl) {
                datePickers['dailyDatePicker'] = new Litepicker({
                    element: dailyDateEl,
                    singleMode: true,
                    autoApply: true,
                    firstDay: 0, // Sunday
                    minDate: minDate,
                    maxDate: maxDate,
                    startDate: latestDateStr,
                    format: 'MMM D, YYYY',
                    lockDaysFilter: (date) => !availableDateSet.has(toDateStr(date)),
                    setup: (picker) => {
                        picker.on('selected', () => loadDailyOps());
                    }
                });
                dailyDateEl.value = formatDate(latestDateStr);
            }
            
            // Initialize Weekly Ops date pickers
            const weeklyStartEl = document.getElementById('weeklyStartDate');
            const weeklyEndEl = document.getElementById('weeklyEndDate');
            if (weeklyStartEl && weeklyEndEl) {
                // Use latest date with data as week end
                const weekEnd = new Date(latestDate);
                const weekStart = new Date(weekEnd);
                weekStart.setDate(weekStart.getDate() - 6);
                
                datePickers['weeklyStartDate'] = new Litepicker({
                    element: weeklyStartEl,
                    singleMode: true,
                    autoApply: true,
                    firstDay: 0, // Sunday
                    minDate: minDate,
                    maxDate: maxDate,
                    startDate: localDateStr(weekStart),
                    format: 'MMM D',
                    lockDaysFilter: (date) => !availableDateSet.has(toDateStr(date)),
                    setup: (picker) => {
                        picker.on('selected', () => {
                            document.getElementById('weekSelector').value = 'custom';
                            loadWeeklyOps();
                        });
                    }
                });
                weeklyStartEl.value = localDateStr(weekStart);
                
                datePickers['weeklyEndDate'] = new Litepicker({
                    element: weeklyEndEl,
                    singleMode: true,
                    autoApply: true,
                    firstDay: 0, // Sunday
                    minDate: minDate,
                    maxDate: maxDate,
                    startDate: localDateStr(weekEnd),
                    format: 'MMM D',
                    lockDaysFilter: (date) => !availableDateSet.has(toDateStr(date)),
                    setup: (picker) => {
                        picker.on('selected', () => {
                            document.getElementById('weekSelector').value = 'custom';
                            loadWeeklyOps();
                        });
                    }
                });
                weeklyEndEl.value = localDateStr(weekEnd);
            }
            
            // Initialize Brands date picker (matching Overview style)
            const brandsDateEl = document.getElementById('brandsDateRange');
            const brandsStartHidden = document.getElementById('brandsDateFilterStart');
            const brandsEndHidden = document.getElementById('brandsDateFilterEnd');
            const brandsPresetSelect = document.getElementById('brandsDatePresetSelect');
            
            if (brandsDateEl && brandsStartHidden && brandsEndHidden) {
                // Default to Last 7 Days ending at latest date with data
                const brands7Start = new Date(latestDate);
                brands7Start.setDate(brands7Start.getDate() - 6);
                brandsStartHidden.value = localDateStr(brands7Start);
                brandsEndHidden.value = latestDateStr;
                
                const brandsPicker = new Litepicker({
                    element: brandsDateEl,
                    singleMode: false,
                    numberOfMonths: 2,
                    numberOfColumns: 2,
                    firstDay: 0,
                    minDate: minDate,
                    maxDate: maxDate,
                    startDate: last7Start,
                    endDate: yesterday,
                    format: 'MMM D, YYYY',
                    delimiter: ' → ',
                    autoApply: true,
                    showTooltip: true,
                    tooltipText: { one: 'day', other: 'days' },
                    lockDaysFilter: (date) => !availableDateSet.has(toDateStr(date)),
                    setup: (picker) => {
                        picker.on('selected', (date1, date2) => {
                            if (date1 && date2) {
                                brandsStartHidden.value = toDateStr(date1);
                                brandsEndHidden.value = toDateStr(date2);
                                if (!applyingPreset && brandsPresetSelect) brandsPresetSelect.value = 'custom';
                                loadBrandsData();
                            }
                        });
                    }
                });
                
                datePickers['brands'] = brandsPicker;
                
                // Handle preset dropdown change
                if (brandsPresetSelect) {
                    brandsPresetSelect.addEventListener('change', function() {
                        const val = this.value;
                        let range = null;
                        
                        switch(val) {
                            case 'yesterday': range = presetRanges['Yesterday']; break;
                            case 'last7': range = presetRanges['Last 7 Days']; break;
                            case 'last14': range = presetRanges['Last 14 Days']; break;
                            case 'last30': range = presetRanges['Last 30 Days']; break;
                            case 'thisMonth': range = presetRanges['This Month']; break;
                            case 'lastMonth': range = presetRanges['Last Month']; break;
                            case 'custom':
                                brandsPicker.show();
                                return;
                        }
                        
                        if (range && range[0] && range[1]) {
                            applyingPreset = true;
                            brandsPicker.setDateRange(range[0], range[1]);
                            applyingPreset = false;
                            brandsStartHidden.value = localDateStr(range[0]);
                            brandsEndHidden.value = localDateStr(range[1]);
                            const formatDisplayDate = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                            brandsDateEl.value = `${formatDisplayDate(range[0])} → ${formatDisplayDate(range[1])}`;
                            loadBrandsData();
                        }
                    });
                }
            }
            
            // Initialize Creators date picker (matching Overview/Brands style)
            const creatorsDateEl = document.getElementById('creatorsDateRange');
            const creatorsStartHidden = document.getElementById('creatorsDateFilterStart');
            const creatorsEndHidden = document.getElementById('creatorsDateFilterEnd');
            const creatorsPresetSelect = document.getElementById('creatorsDatePresetSelect');
            
            if (creatorsDateEl && creatorsStartHidden && creatorsEndHidden) {
                // Default to Last 7 Days ending at latest date with data
                const creators7Start = new Date(latestDate);
                creators7Start.setDate(creators7Start.getDate() - 6);
                creatorsStartHidden.value = localDateStr(creators7Start);
                creatorsEndHidden.value = latestDateStr;
                
                const creatorsPicker = new Litepicker({
                    element: creatorsDateEl,
                    singleMode: false,
                    numberOfMonths: 2,
                    numberOfColumns: 2,
                    firstDay: 0,
                    minDate: minDate,
                    maxDate: maxDate,
                    startDate: creators7Start,
                    endDate: latestDate,
                    format: 'MMM D, YYYY',
                    delimiter: ' → ',
                    autoApply: true,
                    showTooltip: true,
                    tooltipText: { one: 'day', other: 'days' },
                    lockDaysFilter: (date) => !availableDateSet.has(toDateStr(date)),
                    setup: (picker) => {
                        picker.on('selected', (date1, date2) => {
                            if (date1 && date2) {
                                creatorsStartHidden.value = toDateStr(date1);
                                creatorsEndHidden.value = toDateStr(date2);
                                if (!applyingPreset && creatorsPresetSelect) creatorsPresetSelect.value = 'custom';
                                pages.creators = 1;
                                loadCreatorsData();
                            }
                        });
                    }
                });
                
                datePickers['creators'] = creatorsPicker;
                
                // Handle preset dropdown change
                if (creatorsPresetSelect) {
                    creatorsPresetSelect.addEventListener('change', function() {
                        const val = this.value;
                        let range = null;
                        
                        switch(val) {
                            case 'yesterday': range = presetRanges['Yesterday']; break;
                            case 'last7': range = presetRanges['Last 7 Days']; break;
                            case 'last14': range = presetRanges['Last 14 Days']; break;
                            case 'last30': range = presetRanges['Last 30 Days']; break;
                            case 'thisMonth': range = presetRanges['This Month']; break;
                            case 'lastMonth': range = presetRanges['Last Month']; break;
                            case 'custom':
                                creatorsPicker.show();
                                return;
                        }
                        
                        if (range && range[0] && range[1]) {
                            applyingPreset = true;
                            creatorsPicker.setDateRange(range[0], range[1]);
                            applyingPreset = false;
                            creatorsStartHidden.value = localDateStr(range[0]);
                            creatorsEndHidden.value = localDateStr(range[1]);
                            const formatDisplayDate = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                            creatorsDateEl.value = `${formatDisplayDate(range[0])} → ${formatDisplayDate(range[1])}`;
                            pages.creators = 1;
                            loadCreatorsData();
                        }
                    });
                }
            }
            
            // Initialize Ops Center date picker
            const opsDateEl = document.getElementById('opsDateRange');
            const opsStartHidden = document.getElementById('opsDateFilterStart');
            const opsEndHidden = document.getElementById('opsDateFilterEnd');
            const opsPresetSelect = document.getElementById('opsDatePresetSelect');
            
            if (opsDateEl && opsStartHidden && opsEndHidden) {
                // Default to Last 7 Days ending at latest date with data
                const ops7Start = new Date(latestDate);
                ops7Start.setDate(ops7Start.getDate() - 6);
                opsStartHidden.value = localDateStr(ops7Start);
                opsEndHidden.value = latestDateStr;
                
                // Show initial date range
                const formatDisplayDate = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                opsDateEl.value = `${formatDisplayDate(ops7Start)} → ${formatDisplayDate(latestDate)}`;
                
                const opsPicker = new Litepicker({
                    element: opsDateEl,
                    singleMode: false,
                    numberOfMonths: 2,
                    numberOfColumns: 2,
                    firstDay: 0,
                    minDate: minDate,
                    maxDate: maxDate,
                    startDate: ops7Start,
                    endDate: latestDate,
                    format: 'MMM D, YYYY',
                    delimiter: ' → ',
                    autoApply: true,
                    showTooltip: true,
                    tooltipText: { one: 'day', other: 'days' },
                    lockDaysFilter: (date) => !availableDateSet.has(toDateStr(date)),
                    setup: (picker) => {
                        picker.on('selected', (date1, date2) => {
                            if (date1 && date2) {
                                opsStartHidden.value = toDateStr(date1);
                                opsEndHidden.value = toDateStr(date2);
                                if (!applyingPreset && opsPresetSelect) opsPresetSelect.value = 'custom';
                                reloadCurrentOpsTab();
                            }
                        });
                    }
                });
                
                datePickers['ops'] = opsPicker;
                
                // Handle preset dropdown change
                if (opsPresetSelect) {
                    opsPresetSelect.addEventListener('change', function() {
                        const val = this.value;
                        let range = null;
                        
                        switch(val) {
                            case 'yesterday': range = presetRanges['Yesterday']; break;
                            case 'last7': range = presetRanges['Last 7 Days']; break;
                            case 'last14': range = presetRanges['Last 14 Days']; break;
                            case 'last30': range = presetRanges['Last 30 Days']; break;
                            case 'thisMonth': range = presetRanges['This Month']; break;
                            case 'lastMonth': range = presetRanges['Last Month']; break;
                            case 'custom':
                                opsPicker.show();
                                return;
                        }
                        
                        if (range && range[0] && range[1]) {
                            applyingPreset = true;
                            opsPicker.setDateRange(range[0], range[1]);
                            applyingPreset = false;
                            opsStartHidden.value = localDateStr(range[0]);
                            opsEndHidden.value = localDateStr(range[1]);
                            const formatDisplayDate = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                            opsDateEl.value = `${formatDisplayDate(range[0])} → ${formatDisplayDate(range[1])}`;
                            reloadCurrentOpsTab();
                        }
                    });
                }
            }
            
            // Initialize Videos date picker (matching Overview/Creators style)
            const videosDateEl = document.getElementById('videosDateRange');
            const videosStartHidden = document.getElementById('videosDateFilterStart');
            const videosEndHidden = document.getElementById('videosDateFilterEnd');
            const videosPresetSelect = document.getElementById('videosDatePresetSelect');
            
            if (videosDateEl && videosStartHidden && videosEndHidden) {
                // Default to Last 7 Days ending at latest date with data
                const videos7Start = new Date(latestDate);
                videos7Start.setDate(videos7Start.getDate() - 6);
                videosStartHidden.value = localDateStr(videos7Start);
                videosEndHidden.value = latestDateStr;
                
                const videosPicker = new Litepicker({
                    element: videosDateEl,
                    singleMode: false,
                    numberOfMonths: 2,
                    numberOfColumns: 2,
                    firstDay: 0,
                    minDate: minDate,
                    maxDate: maxDate,
                    startDate: videos7Start,
                    endDate: latestDate,
                    format: 'MMM D, YYYY',
                    delimiter: ' → ',
                    autoApply: true,
                    showTooltip: true,
                    tooltipText: { one: 'day', other: 'days' },
                    lockDaysFilter: (date) => !availableDateSet.has(toDateStr(date)),
                    setup: (picker) => {
                        picker.on('selected', (date1, date2) => {
                            if (date1 && date2) {
                                videosStartHidden.value = toDateStr(date1);
                                videosEndHidden.value = toDateStr(date2);
                                if (!applyingPreset && videosPresetSelect) videosPresetSelect.value = 'custom';
                                pages.videos = 1;
                                loadVideosData();
                            }
                        });
                    }
                });
                
                datePickers['videos'] = videosPicker;
                
                // Handle preset dropdown change
                if (videosPresetSelect) {
                    videosPresetSelect.addEventListener('change', function() {
                        const val = this.value;
                        let range = null;
                        
                        switch(val) {
                            case 'yesterday': range = presetRanges['Yesterday']; break;
                            case 'last7': range = presetRanges['Last 7 Days']; break;
                            case 'last14': range = presetRanges['Last 14 Days']; break;
                            case 'last30': range = presetRanges['Last 30 Days']; break;
                            case 'thisMonth': range = presetRanges['This Month']; break;
                            case 'lastMonth': range = presetRanges['Last Month']; break;
                            case 'custom':
                                videosPicker.show();
                                return;
                        }
                        
                        if (range && range[0] && range[1]) {
                            applyingPreset = true;
                            videosPicker.setDateRange(range[0], range[1]);
                            applyingPreset = false;
                            videosStartHidden.value = localDateStr(range[0]);
                            videosEndHidden.value = localDateStr(range[1]);
                            const formatDisplayDate = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                            videosDateEl.value = `${formatDisplayDate(range[0])} → ${formatDisplayDate(range[1])}`;
                            pages.videos = 1;
                            loadVideosData();
                        }
                    });
                }
            }
            
            // Initialize Products date picker (matching Overview/Creators/Videos style)
            const productsDateEl = document.getElementById('productsDateRange');
            const productsStartHidden = document.getElementById('productsDateFilterStart');
            const productsEndHidden = document.getElementById('productsDateFilterEnd');
            const productsPresetSelect = document.getElementById('productsDatePresetSelect');
            
            if (productsDateEl && productsStartHidden && productsEndHidden) {
                // Default to Last 7 Days ending at latest date with data
                const products7Start = new Date(latestDate);
                products7Start.setDate(products7Start.getDate() - 6);
                productsStartHidden.value = localDateStr(products7Start);
                productsEndHidden.value = latestDateStr;
                
                const productsPicker = new Litepicker({
                    element: productsDateEl,
                    singleMode: false,
                    numberOfMonths: 2,
                    numberOfColumns: 2,
                    firstDay: 0,
                    minDate: minDate,
                    maxDate: maxDate,
                    startDate: products7Start,
                    endDate: latestDate,
                    format: 'MMM D, YYYY',
                    delimiter: ' → ',
                    autoApply: true,
                    showTooltip: true,
                    tooltipText: { one: 'day', other: 'days' },
                    lockDaysFilter: (date) => !availableDateSet.has(toDateStr(date)),
                    setup: (picker) => {
                        picker.on('selected', (date1, date2) => {
                            if (date1 && date2) {
                                productsStartHidden.value = toDateStr(date1);
                                productsEndHidden.value = toDateStr(date2);
                                if (!applyingPreset && productsPresetSelect) productsPresetSelect.value = 'custom';
                                pages.products = 1;
                                loadProductsData();
                            }
                        });
                    }
                });
                
                datePickers['products'] = productsPicker;
                
                // Handle preset dropdown change
                if (productsPresetSelect) {
                    productsPresetSelect.addEventListener('change', function() {
                        const val = this.value;
                        let range = null;
                        
                        switch(val) {
                            case 'yesterday': range = presetRanges['Yesterday']; break;
                            case 'last7': range = presetRanges['Last 7 Days']; break;
                            case 'last14': range = presetRanges['Last 14 Days']; break;
                            case 'last30': range = presetRanges['Last 30 Days']; break;
                            case 'thisMonth': range = presetRanges['This Month']; break;
                            case 'lastMonth': range = presetRanges['Last Month']; break;
                            case 'custom':
                                productsPicker.show();
                                return;
                        }
                        
                        if (range && range[0] && range[1]) {
                            applyingPreset = true;
                            productsPicker.setDateRange(range[0], range[1]);
                            applyingPreset = false;
                            productsStartHidden.value = localDateStr(range[0]);
                            productsEndHidden.value = localDateStr(range[1]);
                            const formatDisplayDate = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                            productsDateEl.value = `${formatDisplayDate(range[0])} → ${formatDisplayDate(range[1])}`;
                            pages.products = 1;
                            loadProductsData();
                        }
                    });
                }
            }
            
            // Initialize Roster date picker
            const rosterDateEl = document.getElementById('rosterDateRange');
            const rosterStartHidden = document.getElementById('rosterDateFilterStart');
            const rosterEndHidden = document.getElementById('rosterDateFilterEnd');
            const rosterPresetSelect = document.getElementById('rosterDatePresetSelect');
            
            if (rosterDateEl && rosterStartHidden && rosterEndHidden) {
                // Default to Last 7 Days ending at latest date with data
                const roster7Start = new Date(latestDate);
                roster7Start.setDate(roster7Start.getDate() - 6);
                rosterStartHidden.value = localDateStr(roster7Start);
                rosterEndHidden.value = latestDateStr;
                
                const rosterPicker = new Litepicker({
                    element: rosterDateEl,
                    singleMode: false,
                    numberOfMonths: 2,
                    numberOfColumns: 2,
                    firstDay: 0,
                    minDate: minDate,
                    maxDate: maxDate,
                    startDate: roster7Start,
                    endDate: latestDate,
                    format: 'MMM D, YYYY',
                    delimiter: ' → ',
                    autoApply: true,
                    showTooltip: true,
                    tooltipText: { one: 'day', other: 'days' },
                    lockDaysFilter: (date) => !availableDateSet.has(toDateStr(date)),
                    setup: (picker) => {
                        picker.on('selected', (date1, date2) => {
                            if (date1 && date2) {
                                rosterStartHidden.value = toDateStr(date1);
                                rosterEndHidden.value = toDateStr(date2);
                                if (!applyingPreset && rosterPresetSelect) rosterPresetSelect.value = 'custom';
                                pages.roster = 1;
                                loadRosterData();
                            }
                        });
                    }
                });
                
                datePickers['roster'] = rosterPicker;
                
                // Handle preset dropdown change
                if (rosterPresetSelect) {
                    rosterPresetSelect.addEventListener('change', function() {
                        const val = this.value;
                        let range = null;
                        
                        switch(val) {
                            case 'yesterday': range = presetRanges['Yesterday']; break;
                            case 'last7': range = presetRanges['Last 7 Days']; break;
                            case 'last14': range = presetRanges['Last 14 Days']; break;
                            case 'last30': range = presetRanges['Last 30 Days']; break;
                            case 'thisMonth': range = presetRanges['This Month']; break;
                            case 'lastMonth': range = presetRanges['Last Month']; break;
                            case 'custom':
                                rosterPicker.show();
                                return;
                        }
                        
                        if (range && range[0] && range[1]) {
                            applyingPreset = true;
                            rosterPicker.setDateRange(range[0], range[1]);
                            applyingPreset = false;
                            rosterStartHidden.value = localDateStr(range[0]);
                            rosterEndHidden.value = localDateStr(range[1]);
                            const formatDisplayDate = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                            rosterDateEl.value = `${formatDisplayDate(range[0])} → ${formatDisplayDate(range[1])}`;
                            pages.roster = 1;
                            loadRosterData();
                        }
                    });
                }
            }
        }

        function isManaged(creatorName) {
            const normalized = normalizeTikTok(creatorName);
            if (!normalized) return false;
            return managedCreators.some(mc => 
                normalizeTikTok(mc.account_1) === normalized ||
                normalizeTikTok(mc.account_2) === normalized ||
                normalizeTikTok(mc.account_3) === normalized ||
                normalizeTikTok(mc.account_4) === normalized ||
                normalizeTikTok(mc.account_5) === normalized
            );
        }

        // Check if creator is managed for a specific brand
        function isManagedForBrand(creatorName, brand) {
            const normalized = normalizeTikTok(creatorName);
            if (!normalized) return false;
            return managedCreators.some(mc => 
                mc.brand === brand && (
                    normalizeTikTok(mc.account_1) === normalized ||
                    normalizeTikTok(mc.account_2) === normalized ||
                    normalizeTikTok(mc.account_3) === normalized ||
                    normalizeTikTok(mc.account_4) === normalized ||
                    normalizeTikTok(mc.account_5) === normalized
                )
            );
        }

        function getManagedInfo(creatorName) {
            const lower = (creatorName || '').toLowerCase();
            return managedCreators.find(mc => 
                mc.account_1?.toLowerCase() === lower ||
                mc.account_2?.toLowerCase() === lower ||
                mc.account_3?.toLowerCase() === lower ||
                mc.account_4?.toLowerCase() === lower ||
                mc.account_5?.toLowerCase() === lower
            );
        }

        // Get all brand entries for a Discord name (cross-brand identity)
        function getCreatorByDiscord(discordName) {
            if (!discordName || !discordName.trim()) return [];
            const normalized = discordName.toLowerCase().trim();
            return managedCreators.filter(mc => 
                mc.discord_name?.toLowerCase().trim() === normalized
            );
        }

        // Get all brands a creator is managed for (by Discord)
        function getCreatorBrands(discordName) {
            return getCreatorByDiscord(discordName).map(mc => mc.brand);
        }

        // Check if Discord exists in any brand roster
        function isExistingCreator(discordName) {
            return getCreatorByDiscord(discordName).length > 0;
        }

        // Get canonical creator info (first entry found by Discord)
        function getCanonicalCreatorInfo(discordName) {
            const entries = getCreatorByDiscord(discordName);
            if (entries.length === 0) return null;
            // Return the entry with most complete info
            return entries.reduce((best, current) => {
                let bestScore = (best.real_name ? 1 : 0) + (best.email ? 1 : 0) + (best.account_1 ? 1 : 0);
                let currentScore = (current.real_name ? 1 : 0) + (current.email ? 1 : 0) + (current.account_1 ? 1 : 0);
                return currentScore > bestScore ? current : best;
            });
        }

