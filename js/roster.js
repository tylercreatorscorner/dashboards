// ==================== ROSTER MANAGEMENT ====================
        // ==================== THEME TOGGLE ====================
        function toggleTheme() {
            const html = document.documentElement;
            const currentTheme = html.getAttribute('data-theme') || 'dark';
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            
            html.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            updateThemeUI(newTheme);
        }
        
        function updateThemeUI(theme) {
            const thumb = document.getElementById('themeThumb');
            const label = document.getElementById('themeLabel');
            
            if (thumb) thumb.textContent = theme === 'light' ? '☀️' : '🌙';
            if (label) label.textContent = theme === 'light' ? 'Light Mode' : 'Dark Mode';
        }
        
        // Initialize theme from localStorage
        (function initTheme() {
            const savedTheme = localStorage.getItem('theme') || 'dark';
            document.documentElement.setAttribute('data-theme', savedTheme);
            // Update UI after DOM loads
            document.addEventListener('DOMContentLoaded', () => updateThemeUI(savedTheme));
        })();

        // ==================== BULK ACTIONS ====================
        let selectedRosterIds = new Set();
        let selectedApplicationIds = new Set();
        
        // Roster Bulk Actions
        function toggleRosterSelectAll(checkbox) {
            const checkboxes = document.querySelectorAll('#rosterBody .bulk-checkbox');
            checkboxes.forEach(cb => {
                cb.checked = checkbox.checked;
                const id = cb.dataset.id;
                if (checkbox.checked) {
                    selectedRosterIds.add(id);
                    cb.closest('tr').classList.add('row-selected');
                } else {
                    selectedRosterIds.delete(id);
                    cb.closest('tr').classList.remove('row-selected');
                }
            });
            updateRosterBulkUI();
        }
        
        function toggleRosterSelect(checkbox, id) {
            if (checkbox.checked) {
                selectedRosterIds.add(id);
                checkbox.closest('tr').classList.add('row-selected');
            } else {
                selectedRosterIds.delete(id);
                checkbox.closest('tr').classList.remove('row-selected');
            }
            updateRosterBulkUI();
        }
        
        function updateRosterBulkUI() {
            const count = selectedRosterIds.size;
            document.getElementById('rosterSelectedCount').textContent = count;
            document.getElementById('rosterBulkActions').classList.toggle('show', count > 0);
        }
        
        function clearRosterSelection() {
            selectedRosterIds.clear();
            document.querySelectorAll('#rosterBody .bulk-checkbox').forEach(cb => {
                cb.checked = false;
                cb.closest('tr').classList.remove('row-selected');
            });
            document.querySelector('#view-roster .select-all-checkbox').checked = false;
            updateRosterBulkUI();
        }
        
        async function bulkUpdateRosterStatus(status) {
            // Status column doesn't exist in managed_creators table
            showToast('Status updates not available - column not in database', 'warning');
            return;
        }
        
        async function bulkUpdateRosterRole(role) {
            if (selectedRosterIds.size === 0) return;
            
            const roleLabel = role === 'incubator' ? 'Incubator' : 'Closer';
            if (!confirm(`Set ${selectedRosterIds.size} creator(s) to ${roleLabel}?`)) return;
            
            try {
                for (const id of selectedRosterIds) {
                    await supabaseClient.from('managed_creators').update({ role }).eq('id', id);
                }
                showToast(`${selectedRosterIds.size} creators updated to ${roleLabel}`, 'success');
                clearRosterSelection();
                loadRosterData();
            } catch (err) {
                console.error('Bulk role update error:', err);
                showToast('Error updating creators', 'error');
            }
        }
        
        async function bulkRemoveFromRoster() {
            if (selectedRosterIds.size === 0) return;
            
            if (!confirm(`Remove ${selectedRosterIds.size} creator(s) from roster? This cannot be undone.`)) return;
            
            try {
                for (const id of selectedRosterIds) {
                    await supabaseClient.from('managed_creators').delete().eq('id', id);
                }
                showToast(`${selectedRosterIds.size} creators removed from roster`, 'success');
                clearRosterSelection();
                loadRosterData();
            } catch (err) {
                console.error('Bulk delete error:', err);
                showToast('Error removing creators', 'error');
            }
        }
        
        function bulkExportRoster() {
            if (selectedRosterIds.size === 0) return;
            
            const selectedCreators = window.rosterData?.filter(c => selectedRosterIds.has(c.id)) || [];
            if (selectedCreators.length === 0) {
                showToast('No data to export', 'error');
                return;
            }
            
            const headers = ['Creator', 'Handle', 'Brand', 'Role', 'Status', 'GMV', 'Commission Rate'];
            const rows = selectedCreators.map(c => [
                c.creator_name,
                c.handle,
                c.brand,
                c.role,
                c.status,
                c.gmv || 0,
                c.commission_rate || ''
            ]);
            
            const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
            downloadCSV(csv, `roster-export-${selectedCreators.length}-creators.csv`);
            showToast(`Exported ${selectedCreators.length} creators`, 'success');
        }
        
        // Applications Bulk Actions
        function toggleApplicationsSelectAll(checkbox) {
            const checkboxes = document.querySelectorAll('#applicationsTableBody .bulk-checkbox');
            checkboxes.forEach(cb => {
                cb.checked = checkbox.checked;
                const id = cb.dataset.id;
                if (checkbox.checked) {
                    selectedApplicationIds.add(id);
                    cb.closest('tr').classList.add('row-selected');
                } else {
                    selectedApplicationIds.delete(id);
                    cb.closest('tr').classList.remove('row-selected');
                }
            });
            updateApplicationsBulkUI();
        }
        
        function toggleApplicationSelect(checkbox, id) {
            if (checkbox.checked) {
                selectedApplicationIds.add(id);
                checkbox.closest('tr').classList.add('row-selected');
            } else {
                selectedApplicationIds.delete(id);
                checkbox.closest('tr').classList.remove('row-selected');
            }
            updateApplicationsBulkUI();
        }
        
        function updateApplicationsBulkUI() {
            const count = selectedApplicationIds.size;
            document.getElementById('applicationsSelectedCount').textContent = count;
            document.getElementById('applicationsBulkActions').classList.toggle('show', count > 0);
        }
        
        function clearApplicationsSelection() {
            selectedApplicationIds.clear();
            document.querySelectorAll('#applicationsTableBody .bulk-checkbox').forEach(cb => {
                cb.checked = false;
                cb.closest('tr').classList.remove('row-selected');
            });
            document.querySelector('#view-applications .select-all-checkbox').checked = false;
            updateApplicationsBulkUI();
        }
        
        async function bulkApproveApplications() {
            if (selectedApplicationIds.size === 0) return;
            
            // Fetch the applications to check for Discord
            const { data: applications } = await supabaseClient
                .from('creator_applications')
                .select('*')
                .in('id', Array.from(selectedApplicationIds));
            
            // Check for Discord - accept discord_username, discord_name, or discord_id
            const missingDiscord = applications?.filter(a => {
                const hasDiscord = a.discord_username || a.discord_name || a.discord_id;
                return !hasDiscord || (typeof hasDiscord === 'string' && hasDiscord.trim() === '');
            }) || [];
            
            if (missingDiscord.length > 0) {
                const names = missingDiscord.map(a => a.full_name || a.tiktok_handle || 'Unknown').join(', ');
                showToast(`Cannot approve: ${missingDiscord.length} application(s) missing Discord (${names})`, 'error');
                return;
            }
            
            if (!confirm(`Approve ${selectedApplicationIds.size} application(s) and add to roster?`)) return;
            
            let successCount = 0;
            let errorCount = 0;
            
            try {
                for (const id of selectedApplicationIds) {
                    const app = applications.find(a => a.id === id);
                    if (!app) continue;
                    
                    try {
                        // Get Discord name (prefer OAuth username, then manual entry)
                        const discordName = app.discord_username || app.discord_name;
                        const tiktokHandle = normalizeTikTok(app.tiktok_handle);
                        
                        // First check by discord_id + brand (new flow)
                        let existing = null;
                        if (app.discord_id) {
                            const { data } = await supabaseClient
                                .from('managed_creators')
                                .select('id, discord_id, status')
                                .eq('discord_id', app.discord_id)
                                .eq('brand', app.brand)
                                .single();
                            existing = data;
                        }
                        
                        // Fallback: check by tiktok + brand
                        if (!existing && tiktokHandle) {
                            const { data } = await supabaseClient
                                .from('managed_creators')
                                .select('id, discord_id, status')
                                .eq('account_1', tiktokHandle)
                                .eq('brand', app.brand)
                                .single();
                            existing = data;
                        }
                        
                        let managedCreatorId;
                        
                        if (existing) {
                            // Update existing record (handles Applied → Active transition)
                            await supabaseClient
                                .from('managed_creators')
                                .update({
                                    discord_id: app.discord_id || existing.discord_id,
                                    discord_name: discordName ? normalizeDiscord(discordName) : undefined,
                                    discord_avatar: app.discord_avatar || undefined,
                                    email: app.email || undefined,
                                    real_name: app.full_name || undefined,
                                    application_id: app.id,
                                    status: 'Active',
                                    joined_at: new Date().toISOString()
                                })
                                .eq('id', existing.id);
                            
                            managedCreatorId = existing.id;
                        } else {
                            // Create new managed_creator (legacy flow)
                            const { data: newCreator, error: insertError } = await supabaseClient
                                .from('managed_creators')
                                .insert({
                                    real_name: app.full_name || null,
                                    discord_name: normalizeDiscord(discordName) || null,
                                    discord_id: app.discord_id || null,
                                    discord_avatar: app.discord_avatar || null,
                                    email: app.email || null,
                                    brand: app.brand || 'catakor',
                                    role: 'Incubator',
                                    status: 'Active',
                                    account_1: tiktokHandle,
                                    application_id: app.id,
                                    joined_at: new Date().toISOString(),
                                    notes: `Bulk approved on ${new Date().toLocaleDateString()}${app.discord_id ? ' (Discord OAuth)' : ''}`
                                })
                                .select()
                                .single();
                            
                            if (insertError) throw insertError;
                            managedCreatorId = newCreator.id;
                        }
                        
                        // Update application status and link
                        await supabaseClient
                            .from('creator_applications')
                            .update({ 
                                status: 'accepted',
                                managed_creator_id: managedCreatorId,
                                reviewed_by: adminName || 'Admin',
                                reviewed_at: new Date().toISOString(),
                                updated_at: new Date().toISOString()
                            })
                            .eq('id', id);
                        
                        successCount++;
                    } catch (appErr) {
                        console.warn('Failed to process application:', app.id, appErr);
                        errorCount++;
                    }
                }
                
                if (errorCount > 0) {
                    showToast(`${successCount} approved, ${errorCount} failed`, 'warning');
                } else {
                    showToast(`${successCount} applications approved and added to roster`, 'success');
                }
                
                clearApplicationsSelection();
                loadApplicationsData();
                await loadManagedCreators();
            } catch (err) {
                console.error('Bulk approve error:', err);
                showToast('Error approving applications', 'error');
            }
        }
        
        async function bulkRejectApplications() {
            if (selectedApplicationIds.size === 0) return;
            
            if (!confirm(`Reject ${selectedApplicationIds.size} application(s)?`)) return;
            
            try {
                for (const id of selectedApplicationIds) {
                    await supabaseClient.from('creator_applications').update({ status: 'rejected' }).eq('id', id);
                }
                showToast(`${selectedApplicationIds.size} applications rejected`, 'success');
                clearApplicationsSelection();
                loadApplicationsData();
            } catch (err) {
                console.error('Bulk reject error:', err);
                showToast('Error rejecting applications', 'error');
            }
        }
        
        function bulkExportApplications() {
            if (selectedApplicationIds.size === 0) return;
            
            const selectedApps = window.applicationsData?.filter(a => selectedApplicationIds.has(a.id)) || [];
            if (selectedApps.length === 0) {
                showToast('No data to export', 'error');
                return;
            }
            
            const headers = ['Name', 'Email', 'TikTok Handle', 'Brand', 'Followers', 'Status', 'Applied Date'];
            const rows = selectedApps.map(a => [
                a.name,
                a.email,
                a.tiktok_handle,
                a.brand,
                a.followers || '',
                a.status,
                new Date(a.created_at).toLocaleDateString()
            ]);
            
            const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
            downloadCSV(csv, `applications-export-${selectedApps.length}.csv`);
            showToast(`Exported ${selectedApps.length} applications`, 'success');
        }
        
        function downloadCSV(content, filename) {
            const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            link.click();
        }

        // ==================== ROSTER ====================
        let rosterCache = { filtered: [], withPerformance: [], grouped: [] };
        let rosterViewMode = 'identity'; // 'identity' or 'entries'
        
        // Handle brand filter change - populate product dropdown
        async function onRosterBrandFilterChange() {
            const brand = document.getElementById('rosterBrandFilter')?.value || 'all';
            const productFilter = document.getElementById('rosterProductFilter');
            
            if (!productFilter) {
                pages.roster = 1;
                loadRosterData();
                return;
            }
            
            // Hide product filter if "All Brands" selected
            if (brand === 'all') {
                productFilter.style.display = 'none';
                productFilter.value = 'all';
                pages.roster = 1;
                loadRosterData();
                return;
            }
            
            // Fetch products for this brand
            try {
                if (!brandProductsCache[brand]) {
                    const { data, error } = await supabaseClient
                        .from('products')
                        .select('product_key, display_name, product_ids')
                        .eq('brand', brand)
                        .eq('status', 'active')
                        .order('display_name');
                    
                    if (error) throw error;
                    brandProductsCache[brand] = data || [];
                }
                
                const products = brandProductsCache[brand];
                
                if (products.length === 0) {
                    productFilter.style.display = 'none';
                    productFilter.value = 'all';
                } else {
                    // Count creators assigned to each product
                    const productCounts = {};
                    managedCreators.filter(c => c.brand === brand).forEach(c => {
                        const pr = c.product_retainers || {};
                        Object.keys(pr).forEach(key => {
                            productCounts[key] = (productCounts[key] || 0) + 1;
                        });
                    });
                    
                    productFilter.innerHTML = '<option value="all">All Products</option>' + 
                        products.map(p => {
                            const count = productCounts[p.product_key] || 0;
                            const skuCount = (p.product_ids || []).length;
                            return `<option value="${p.product_key}">${p.display_name} (${count} creators${skuCount > 1 ? `, ${skuCount} SKUs` : ''})</option>`;
                        }).join('');
                    productFilter.style.display = 'block';
                }
            } catch (err) {
                console.error('Error loading products for roster filter:', err);
                productFilter.style.display = 'none';
            }
            
            pages.roster = 1;
            loadRosterData();
        }
        
        function setRosterView(mode) {
            rosterViewMode = mode;
            document.getElementById('rosterViewIdentity').classList.toggle('active', mode === 'identity');
            document.getElementById('rosterViewEntries').classList.toggle('active', mode === 'entries');
            document.getElementById('rosterTableTitle').textContent = mode === 'identity' ? 'All Creators' : 'All Roster Entries';
            pages.roster = 1;
            renderRosterTable();
        }
        
        async function loadRosterData() {
            showLoading('roster', 'Loading roster data...');
            try {
            const brand = document.getElementById('rosterBrandFilter').value;
            const selectedProduct = document.getElementById('rosterProductFilter')?.value || 'all';
            const status = document.getElementById('rosterStatusFilter').value;
            const search = document.getElementById('rosterSearchInput').value.toLowerCase();
            const startDate = document.getElementById('rosterDateFilterStart').value;
            const endDate = document.getElementById('rosterDateFilterEnd').value;

            if (!startDate || !endDate) { hideLoading('roster'); return; }

            // Calculate prior period
            const start = new Date(startDate);
            const end = new Date(endDate);
            const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
            const priorEnd = new Date(start);
            priorEnd.setDate(priorEnd.getDate() - 1);
            const priorStart = new Date(priorEnd);
            priorStart.setDate(priorStart.getDate() - daysDiff + 1);
            const priorStartStr = priorStart.toISOString().split('T')[0];
            const priorEndStr = priorEnd.toISOString().split('T')[0];

            // Fetch current period performance with pagination
            let currentPerfData = [];
            let page = 0;
            const pageSize = 30000; // Matches Supabase query limit
            let hasMore = true;
            
            while (hasMore) {
                let query = supabaseClient.from('creator_performance')
                    .select('creator_name, brand, gmv, orders, videos')
                    .gte('report_date', startDate)
                    .lte('report_date', endDate)
                    .eq('period_type', 'daily')
                    .range(page * pageSize, (page + 1) * pageSize - 1);
                
                if (brand !== 'all') query = query.eq('brand', brand);
                
                const { data, error } = await query;
                if (error || !data || data.length === 0) {
                    hasMore = false;
                } else {
                    currentPerfData = currentPerfData.concat(data);
                    hasMore = data.length === pageSize;
                    page++;
                }
                if (page >= MAX_PAGES) break; // 10 pages × 30k = 300k rows max
            }

            // Fetch prior period performance
            let priorPerfData = [];
            page = 0;
            hasMore = true;
            
            while (hasMore) {
                let query = supabaseClient.from('creator_performance')
                    .select('creator_name, brand, gmv')
                    .gte('report_date', priorStartStr)
                    .lte('report_date', priorEndStr)
                    .eq('period_type', 'daily')
                    .range(page * pageSize, (page + 1) * pageSize - 1);
                
                if (brand !== 'all') query = query.eq('brand', brand);
                
                const { data, error } = await query;
                if (error || !data || data.length === 0) {
                    hasMore = false;
                } else {
                    priorPerfData = priorPerfData.concat(data);
                    hasMore = data.length === pageSize;
                    page++;
                }
                if (page >= MAX_PAGES) break; // 10 pages × 30k = 300k rows max
            }

            // Build performance maps - keyed by brand:creator_name for per-brand tracking
            // Use normalizeTikTok to strip @ and normalize handles
            const currentPerfMap = new Map();
            
            currentPerfData.forEach(row => {
                const creatorKey = normalizeTikTok(row.creator_name);
                if (!creatorKey) return;
                
                // Normalize brand to lowercase for consistent matching
                const normalizedBrand = (row.brand || '').toLowerCase();
                
                // Store by brand:creator_name for per-brand lookups
                const brandKey = `${normalizedBrand}:${creatorKey}`;
                if (!currentPerfMap.has(brandKey)) {
                    currentPerfMap.set(brandKey, { gmv: 0, orders: 0, videos: 0 });
                }
                const p = currentPerfMap.get(brandKey);
                p.gmv += pFloat(row.gmv);
                p.orders += pInt(row.orders);
                p.videos += pInt(row.videos);
            });

            const priorPerfMap = new Map();
            priorPerfData.forEach(row => {
                const creatorKey = normalizeTikTok(row.creator_name);
                if (!creatorKey) return;
                
                const normalizedBrand = (row.brand || '').toLowerCase();
                const brandKey = `${normalizedBrand}:${creatorKey}`;
                if (!priorPerfMap.has(brandKey)) {
                    priorPerfMap.set(brandKey, { gmv: 0 });
                }
                priorPerfMap.get(brandKey).gmv += pFloat(row.gmv);
            });

            // Filter roster
            let roster = [...managedCreators];
            if (brand !== 'all') roster = roster.filter(c => c.brand === brand);
            if (selectedProduct !== 'all') roster = filterCreatorsByProduct(roster, selectedProduct);
            if (status !== 'all') roster = roster.filter(c => (c.status || 'Active') === status);
            if (search) roster = roster.filter(c => 
                c.real_name?.toLowerCase().includes(search) || 
                c.discord_name?.toLowerCase().includes(search) || 
                c.account_1?.toLowerCase().includes(search) ||
                c.account_2?.toLowerCase().includes(search) ||
                c.account_3?.toLowerCase().includes(search) ||
                c.email?.toLowerCase().includes(search)
            );

            // Build multi-brand map (detect creators who work across multiple brands)
            const accountToBrands = new Map(); // account -> Set of brands
            const emailToBrands = new Map(); // email -> Set of brands
            const discordToBrands = new Map(); // discord -> Set of brands
            
            managedCreators.forEach(c => {
                const accounts = [c.account_1, c.account_2, c.account_3, c.account_4, c.account_5].filter(a => a);
                accounts.forEach(acc => {
                    const key = acc.toLowerCase();
                    if (!accountToBrands.has(key)) accountToBrands.set(key, new Set());
                    accountToBrands.get(key).add(c.brand);
                });
                if (c.email) {
                    const key = c.email.toLowerCase();
                    if (!emailToBrands.has(key)) emailToBrands.set(key, new Set());
                    emailToBrands.get(key).add(c.brand);
                }
                if (c.discord_name) {
                    const key = c.discord_name.toLowerCase();
                    if (!discordToBrands.has(key)) discordToBrands.set(key, new Set());
                    discordToBrands.get(key).add(c.brand);
                }
            });

            // Function to get all brands for a creator
            const getOtherBrands = (c) => {
                const allBrands = new Set();
                const accounts = [c.account_1, c.account_2, c.account_3, c.account_4, c.account_5].filter(a => a);
                accounts.forEach(acc => {
                    const brands = accountToBrands.get(acc.toLowerCase());
                    if (brands) brands.forEach(b => allBrands.add(b));
                });
                if (c.email) {
                    const brands = emailToBrands.get(c.email.toLowerCase());
                    if (brands) brands.forEach(b => allBrands.add(b));
                }
                if (c.discord_name) {
                    const brands = discordToBrands.get(c.discord_name.toLowerCase());
                    if (brands) brands.forEach(b => allBrands.add(b));
                }
                // Remove current brand to get "other" brands
                allBrands.delete(c.brand);
                return [...allBrands];
            };

            // Attach performance data to roster
            const rosterWithPerf = roster.map(c => {
                // Get performance for all accounts - using brand-specific keys
                const accounts = [c.account_1, c.account_2, c.account_3, c.account_4, c.account_5].filter(a => a);
                let gmv = 0, orders = 0, videos = 0, priorGmv = 0;
                
                // Normalize brand to match map keys
                const normalizedBrand = (c.brand || '').toLowerCase();
                
                accounts.forEach(acc => {
                    // Use normalizeTikTok for consistent handle matching
                    const normalizedHandle = normalizeTikTok(acc);
                    if (!normalizedHandle) return;
                    
                    // Use brand:creator_name key for per-brand GMV
                    const brandKey = `${normalizedBrand}:${normalizedHandle}`;
                    const current = currentPerfMap.get(brandKey);
                    const prior = priorPerfMap.get(brandKey);
                    
                    if (current) {
                        gmv += current.gmv;
                        orders += current.orders;
                        videos += current.videos;
                    }
                    if (prior) {
                        priorGmv += prior.gmv;
                    }
                });

                const gmvChange = priorGmv > 0 ? ((gmv - priorGmv) / priorGmv * 100) : (gmv > 0 ? 100 : 0);
                const tier = getTier(gmv);
                const otherBrands = getOtherBrands(c);

                return {
                    ...c,
                    gmv,
                    orders,
                    videos,
                    priorGmv,
                    gmvChange,
                    tier,
                    otherBrands,
                    isMultiBrand: otherBrands.length > 0
                };
            });

            // Sort by GMV descending
            rosterWithPerf.sort((a, b) => b.gmv - a.gmv);
            
            // Cache for export and insights
            rosterCache.filtered = roster;
            rosterCache.withPerformance = rosterWithPerf;
            rosterCache.perfMap = currentPerfMap; // Cache for per-account GMV lookups

            // Group by Discord for identity view
            const identityMap = new Map(); // discord -> grouped creator
            rosterWithPerf.forEach(c => {
                const key = c.discord_name ? c.discord_name.toLowerCase().trim() : `no-discord-${c.id}`;
                
                if (!identityMap.has(key)) {
                    identityMap.set(key, {
                        // Identity info (use first found)
                        id: c.id,
                        discord_name: c.discord_name,
                        real_name: c.real_name,
                        email: c.email,
                        phone: c.phone,
                        // Aggregated data
                        totalGmv: 0,
                        totalPriorGmv: 0,
                        totalRetainer: 0,
                        // Brand entries
                        entries: [],
                        brands: [],
                        uniqueBrands: new Set(),
                        roles: new Set(),
                        // Dates
                        joinedDate: null,
                        // Status (any active = active)
                        hasActive: false,
                        allStatuses: [],
                        // Data health
                        hasMissingData: false
                    });
                }
                
                const identity = identityMap.get(key);
                identity.entries.push(c);
                identity.brands.push(c.brand);
                identity.uniqueBrands.add(c.brand);
                if (c.role) identity.roles.add(c.role);
                identity.totalGmv += c.gmv;
                identity.totalPriorGmv += c.priorGmv;
                identity.totalRetainer += getTotalRetainer(c);
                identity.allStatuses.push(c.status || 'Active');
                if ((c.status || 'Active') === 'Active') identity.hasActive = true;
                
                // Use most complete name
                if (!identity.real_name && c.real_name) identity.real_name = c.real_name;
                if (!identity.email && c.email) identity.email = c.email;
                
                // Track earliest joined date
                if (c.created_at) {
                    if (!identity.joinedDate || c.created_at < identity.joinedDate) {
                        identity.joinedDate = c.created_at;
                    }
                }
                
                // Check data health
                if (!c.discord_name || !c.account_1 || !c.real_name) {
                    identity.hasMissingData = true;
                }
            });
            
            // Convert to array and add computed fields
            const groupedCreators = [...identityMap.values()].map(identity => ({
                ...identity,
                gmvChange: identity.totalPriorGmv > 0 
                    ? ((identity.totalGmv - identity.totalPriorGmv) / identity.totalPriorGmv * 100) 
                    : (identity.totalGmv > 0 ? 100 : 0),
                tier: getTier(identity.totalGmv),
                isMultiBrand: identity.uniqueBrands.size > 1,
                primaryStatus: identity.hasActive ? 'Active' : identity.allStatuses[0] || 'Active',
                primaryRole: identity.entries[0]?.role || 'Incubator',
                allRoles: [...identity.roles],
                uniqueBrandsList: [...identity.uniqueBrands]
            }));
            
            // Sort grouped by total GMV
            groupedCreators.sort((a, b) => b.totalGmv - a.totalGmv);
            rosterCache.grouped = groupedCreators;

            // Apply quick filter
            const quickFilter = document.getElementById('rosterQuickFilter')?.value || 'all';
            let filteredGrouped = [...groupedCreators];
            const today = new Date().toISOString().split('T')[0];
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            
            if (quickFilter === 'top_performers') {
                filteredGrouped = filteredGrouped.filter(c => ['Gold', 'Platinum', 'Diamond', 'Ruby'].includes(c.tier.name));
            } else if (quickFilter === 'at_risk') {
                filteredGrouped = filteredGrouped.filter(c => c.gmvChange < -20);
            } else if (quickFilter === 'has_retainer') {
                filteredGrouped = filteredGrouped.filter(c => c.totalRetainer > 0);
            } else if (quickFilter === 'has_product') {
                filteredGrouped = filteredGrouped.filter(c => c.entries.some(e => hasAnyProductAssignment(e)));
            } else if (quickFilter === 'multi_brand') {
                filteredGrouped = filteredGrouped.filter(c => c.isMultiBrand);
            } else if (quickFilter === 'new_creators') {
                filteredGrouped = filteredGrouped.filter(c => c.joinedDate && c.joinedDate >= thirtyDaysAgo);
            } else if (quickFilter === 'missing_data') {
                filteredGrouped = filteredGrouped.filter(c => c.hasMissingData);
            }
            
            rosterCache.filteredGrouped = filteredGrouped;

            // Calculate stats (based on unique creators)
            const uniqueCreators = groupedCreators.length;
            const totalEntries = rosterWithPerf.length;
            const totalGmv = groupedCreators.reduce((s, c) => s + c.totalGmv, 0);
            const totalPriorGmv = groupedCreators.reduce((s, c) => s + c.totalPriorGmv, 0);
            const totalRetainer = groupedCreators.reduce((s, c) => s + c.totalRetainer, 0);
            const activeCount = groupedCreators.filter(c => c.hasActive).length;
            const churnedCount = groupedCreators.filter(c => !c.hasActive).length;
            const multiBrandCount = groupedCreators.filter(c => c.isMultiBrand).length;
            const avgGmv = uniqueCreators > 0 ? totalGmv / uniqueCreators : 0;
            const gmvChange = totalPriorGmv > 0 ? ((totalGmv - totalPriorGmv) / totalPriorGmv * 100) : 0;
            const missingDataCount = groupedCreators.filter(c => c.hasMissingData).length;

            // Update stats
            document.getElementById('rosterStatGmv').textContent = fmtMoney(totalGmv);
            const gmvChangeEl = document.getElementById('rosterStatGmvChange');
            if (gmvChangeEl) {
                if (gmvChange !== 0) {
                    gmvChangeEl.textContent = `${gmvChange >= 0 ? '↑' : '↓'} ${Math.abs(gmvChange).toFixed(1)}% vs prior`;
                    gmvChangeEl.className = `stat-change ${gmvChange >= 0 ? 'positive' : 'negative'}`;
                } else {
                    gmvChangeEl.textContent = '--';
                    gmvChangeEl.className = 'stat-change neutral';
                }
            }
            document.getElementById('rosterStatUniqueCreators').textContent = uniqueCreators;
            document.getElementById('rosterStatEntriesCount').textContent = `${totalEntries} roster entries`;
            document.getElementById('rosterStatActive').textContent = activeCount;
            document.getElementById('rosterStatChurned').textContent = `${churnedCount} churned`;
            document.getElementById('rosterStatAvgGmv').textContent = fmtMoney(avgGmv);
            document.getElementById('rosterStatMultiBrand').textContent = multiBrandCount;
            const multiBrandPctEl = document.getElementById('rosterStatMultiBrandPct');
            if (multiBrandPctEl) multiBrandPctEl.textContent = uniqueCreators > 0 ? `${Math.round(multiBrandCount / uniqueCreators * 100)}% of roster` : '0%';
            document.getElementById('rosterStatRetainer').textContent = fmtMoney(totalRetainer);
            const missingDataEl = document.getElementById('rosterStatMissingData');
            if (missingDataEl) missingDataEl.textContent = missingDataCount;

            // Render insights
            renderRosterInsights(rosterWithPerf);

            // Load applications
            loadApplicationsSummary();

            // Render table based on current view mode
            renderRosterTable();
            } finally {
                hideLoading('roster');
            }
        }

        function renderRosterTable() {
            const rosterWithPerf = rosterCache.withPerformance || [];
            const groupedCreators = rosterCache.filteredGrouped || rosterCache.grouped || [];
            
            const getRoleClass = (r) => {
                if (r === 'Incubator') return 'background:var(--blue-dim);color:var(--blue)';
                if (r === 'Closer') return 'background:var(--purple-dim);color:var(--purple)';
                if (r === 'Creatives') return 'background:var(--warning-dim);color:var(--warning)';
                return 'background:var(--bg-secondary);color:var(--text-secondary)';
            };

            const getStatusClass = (s) => {
                if (s === 'Active') return 'background:var(--success-dim);color:var(--success)';
                if (s === 'Active') return 'background:var(--success-dim);color:var(--success)';
                if (s === 'On Hold') return 'background:var(--warning-dim);color:var(--warning)';
                if (s === 'Churned') return 'background:var(--danger-dim);color:var(--danger)';
                return 'background:var(--bg-secondary);color:var(--text-secondary)';
            };

            if (rosterViewMode === 'identity') {
                // Identity view - grouped by creator
                document.getElementById('rosterTableHead').innerHTML = `
                    <tr>
                        <th style="width: 40px;"><input type="checkbox" class="select-all-checkbox" onchange="toggleRosterSelectAll(this)"></th>
                        <th>Creator</th>
                        <th>Brands</th>
                        <th>Total GMV</th>
                        <th>Tier</th>
                        <th>Status</th>
                        <th>Retainer</th>
                        <th>ROI</th>
                        <th>Health</th>
                        <th>Joined</th>
                        <th>Actions</th>
                    </tr>
                `;
                
                document.getElementById('rosterTableCount').textContent = `${groupedCreators.length} creators`;
                
                const startIdx = (pages.roster - 1) * PAGE_SIZE;
                const pageData = groupedCreators.slice(startIdx, startIdx + PAGE_SIZE);
                
                // Helper to format joined date
                const formatJoinedDate = (dateStr) => {
                    if (!dateStr) return '−';
                    const d = new Date(dateStr);
                    const now = new Date();
                    const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));
                    if (diffDays < 7) return `${diffDays}d ago`;
                    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
                    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
                    return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
                };
                
                document.getElementById('rosterBody').innerHTML = pageData.map(c => {
                    const displayName = c.real_name || c.discord_name || c.entries[0]?.account_1 || 'Unknown';
                    
                    // Build brand pills - unique brands with count if multiple entries for same brand
                    const brandCounts = {};
                    c.brands.forEach(b => { brandCounts[b] = (brandCounts[b] || 0) + 1; });
                    const brandPills = c.uniqueBrandsList.map(b => {
                        const count = brandCounts[b];
                        return `<span class="brand-pill ${b}">${BRAND_DISPLAY[b] || b}${count > 1 ? ` (${count})` : ''}</span>`;
                    }).join('');
                    
                    const rowIdentifier = String(c.discord_name || c.entries[0]?.id || '');
                    
                    // Data health indicator
                    const healthIcon = c.hasMissingData 
                        ? '<span title="Missing data (Discord, TikTok, or Name)" style="color: var(--warning);">⚠️</span>'
                        : '<span title="Complete" style="color: var(--success);">✓</span>';
                    
                    return `
                        <tr class="roster-row-expandable" onclick="toggleCreatorExpand(this, '${rowIdentifier.replace(/'/g, "\\'")}')">
                            <td onclick="event.stopPropagation();">
                                <span class="roster-expand-icon">▶</span>
                                <input type="checkbox" class="bulk-checkbox" data-discord="${rowIdentifier.replace(/"/g, '&quot;')}" onchange="toggleRosterSelectIdentity(this)">
                            </td>
                            <td>
                                <div class="creator-cell">
                                    <div class="creator-avatar">${displayName.charAt(0).toUpperCase()}</div>
                                    <div>
                                        <span class="creator-name">${displayName}</span>
                                        ${c.discord_name ? `<div style="font-size: 0.75rem; color: var(--text-muted);">💬 ${c.discord_name}</div>` : ''}
                                    </div>
                                </div>
                            </td>
                            <td><div class="brand-pills">${brandPills}</div></td>
                            <td>
                                <span class="gmv-value ${c.totalGmv >= 1000 ? 'gmv-high' : ''}">${fmtMoney(c.totalGmv)}</span>
                                ${c.gmvChange !== 0 ? `<div style="font-size: 0.7rem;" class="${c.gmvChange >= 0 ? 'positive' : 'negative'}">${c.gmvChange >= 0 ? '↑' : '↓'}${Math.abs(c.gmvChange).toFixed(0)}%</div>` : ''}
                            </td>
                            <td><span class="badge-tier ${c.tier.class}">${c.tier.name}</span></td>
                            <td><span class="badge" style="${getStatusClass(c.primaryStatus)}">${c.primaryStatus}</span></td>
                            <td style="font-size: 0.85rem;">${(() => {
                                // Build retainer breakdown for tooltip
                                const parts = [];
                                c.entries.forEach(e => {
                                    const brandName = BRAND_DISPLAY[e.brand] || e.brand;
                                    if (e.retainer > 0) {
                                        parts.push(`${brandName}: ${fmtMoney(e.retainer)} base`);
                                    }
                                    const pr = e.product_retainers || {};
                                    Object.entries(pr).filter(([k,v]) => v > 0).forEach(([k,v]) => {
                                        const prodName = k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                                        parts.push(`${brandName} ${prodName}: ${fmtMoney(v)}`);
                                    });
                                });
                                const tooltipText = parts.length > 0 ? parts.join('\\n') : '';
                                
                                if (c.totalRetainer > 0) {
                                    const hasMultiple = parts.length > 1;
                                    return `<span style="color: var(--success); cursor: ${hasMultiple ? 'help' : 'default'};" ${hasMultiple ? `title="${tooltipText}"` : ''}>${fmtMoney(c.totalRetainer)}${hasMultiple ? ' *' : ''}</span>`;
                                } else if (c.entries.some(e => e.retainer === 0 || Object.values(e.product_retainers || {}).some(v => v === 0))) {
                                    return '<span class="badge" style="background: var(--blue-dim); color: var(--blue); font-size: 0.7rem;">Affiliate</span>';
                                }
                                return '<span style="color: var(--text-muted);">−</span>';
                            })()}</td>
                            <td style="font-size: 0.85rem; text-align: center;">${c.totalRetainer > 0 ? (() => {
                                const roi = (c.totalGmv / c.totalRetainer).toFixed(1);
                                const color = roi >= 1 ? 'var(--success)' : 'var(--error)';
                                return `<span style="color: ${color}; font-weight: 600;">${roi}x</span>`;
                            })() : '<span style="color: var(--text-muted);">−</span>'}</td>
                            <td style="text-align: center;">${healthIcon}</td>
                            <td style="font-size: 0.85rem; color: var(--text-muted);">${formatJoinedDate(c.joinedDate)}</td>
                            <td onclick="event.stopPropagation();">
                                <button class="action-btn" onclick="addCreatorToBrand('${rowIdentifier.replace(/'/g, "\\'")}')" title="Add to Brand" style="background: var(--success-dim); color: var(--success);">➕</button>
                            </td>
                        </tr>
                        <tr class="roster-detail-row" id="detail-${rowIdentifier.replace(/[^a-zA-Z0-9]/g, '_')}" style="display: none;">
                            <td colspan="11">
                                <div class="roster-brand-details">
                                    ${c.entries.map(e => {
                                        // Get all accounts for this entry
                                        const accounts = [e.account_1, e.account_2, e.account_3, e.account_4, e.account_5].filter(a => a && a.trim());
                                        const normalizedBrand = (e.brand || '').toLowerCase();
                                        const perfMap = rosterCache.perfMap || new Map();
                                        
                                        // Calculate per-account GMV
                                        const accountGmvs = accounts.map(acc => {
                                            const key = `${normalizedBrand}:${normalizeTikTok(acc)}`;
                                            const perf = perfMap.get(key);
                                            return {
                                                account: acc,
                                                gmv: perf?.gmv || 0
                                            };
                                        });
                                        
                                        const entryTotalGmv = accountGmvs.reduce((s, a) => s + a.gmv, 0);
                                        
                                        // Check if there are other entries for same brand (mergeable)
                                        const sameBrandEntries = c.entries.filter(x => x.brand === e.brand);
                                        const canMerge = sameBrandEntries.length > 1;
                                        const otherEntry = canMerge ? sameBrandEntries.find(x => x.id !== e.id) : null;
                                        
                                        return `
                                        <div class="roster-brand-detail-item" style="flex-direction: column; align-items: stretch;">
                                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                                <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                                                    <span class="badge-brand">${BRAND_DISPLAY[e.brand] || e.brand}</span>
                                                    ${getRetainerBreakdownHtml(e)}
                                                </div>
                                                <div style="display: flex; align-items: center; gap: 12px;">
                                                    <span class="gmv-value">${fmtMoney(entryTotalGmv)}</span>
                                                    <span class="badge-tier ${e.tier.class}">${e.tier.name}</span>
                                                    ${canMerge && otherEntry ? `<button class="action-btn" onclick="quickMergeEntries(${e.id}, ${otherEntry.id})" title="Merge other entry into this one" style="background: var(--purple-dim); color: var(--purple);">⊕</button>` : ''}
                                                    <button class="action-btn view" onclick="editCreator(${e.id})" title="Edit">✎</button>
                                                    <button class="action-btn remove" onclick="deleteCreator(${e.id}, '${(e.real_name || e.account_1 || '').replace(/'/g, "\\'")}')" title="Remove Entry">×</button>
                                                </div>
                                            </div>
                                            <div style="background: var(--bg-primary); border-radius: 6px; padding: 8px 12px;">
                                                ${accountGmvs.map((a, idx) => `
                                                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0; ${idx < accountGmvs.length - 1 ? 'border-bottom: 1px solid var(--border);' : ''}">
                                                        <span style="color: var(--text-muted);">@${a.account}</span>
                                                        <div style="display: flex; align-items: center; gap: 12px;">
                                                            <span style="font-weight: 500; ${a.gmv > 0 ? 'color: var(--success);' : 'color: var(--text-muted);'}">${fmtMoney(a.gmv)}</span>
                                                            <button class="action-btn" onclick="openCreatorDetail('${a.account.replace(/'/g, "\\'")}', '${e.brand}')" title="View Stats" style="padding: 2px 6px; font-size: 0.75rem;">📊</button>
                                                        </div>
                                                    </div>
                                                `).join('')}
                                            </div>
                                        </div>
                                    `;}).join('')}
                                    <div style="display: flex; justify-content: flex-end; gap: 8px; padding-top: 8px; border-top: 1px solid var(--border);">
                                        <span style="color: var(--text-muted); font-size: 0.85rem;">
                                            Total Retainer: <strong style="color: var(--accent);">${fmtMoney(c.totalRetainer)}/mo</strong>
                                        </span>
                                    </div>
                                </div>
                            </td>
                        </tr>
                    `;
                }).join('') || '<tr><td colspan="11"><div class="empty-state"><h3>No creators in roster</h3><p>Add creators to start tracking their performance</p></div></td></tr>';
                
                renderPagination('rosterPagination', groupedCreators.length, pages.roster, (p) => { pages.roster = p; renderRosterTable(); });
                
            } else {
                // Entries view - one row per brand entry (original behavior)
                document.getElementById('rosterTableHead').innerHTML = `
                    <tr>
                        <th style="width: 40px;"><input type="checkbox" class="select-all-checkbox" onchange="toggleRosterSelectAll(this)"></th>
                        <th>Creator</th>
                        <th>Brand</th>
                        <th>Status</th>
                        <th>GMV</th>
                        <th>Tier</th>
                        <th>Retainer</th>
                        <th>ROI</th>
                        <th>Health</th>
                        <th>Joined</th>
                        <th>Actions</th>
                    </tr>
                `;
                
                // Helper to format joined date
                const formatJoinedDate = (dateStr) => {
                    if (!dateStr) return '−';
                    const d = new Date(dateStr);
                    const now = new Date();
                    const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));
                    if (diffDays < 7) return `${diffDays}d ago`;
                    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
                    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
                    return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
                };
                
                document.getElementById('rosterTableCount').textContent = `${rosterWithPerf.length} entries`;
                
                const startIdx = (pages.roster - 1) * PAGE_SIZE;
                const pageData = rosterWithPerf.slice(startIdx, startIdx + PAGE_SIZE);
                
                document.getElementById('rosterBody').innerHTML = pageData.map(c => {
                    const primaryAccount = c.account_1 || '';
                    const creatorStatus = c.status || 'Active';
                    const multiBrandIndicator = c.isMultiBrand 
                        ? `<span title="Also works with: ${c.otherBrands.map(b => BRAND_DISPLAY[b] || b).join(', ')}" style="cursor: help; margin-left: 4px; font-size: 0.7rem; background: var(--purple-dim); color: var(--purple); padding: 2px 6px; border-radius: 4px;">+${c.otherBrands.length}</span>` 
                        : '';
                    
                    // Data health check
                    const hasMissingData = !c.discord_name || !c.account_1 || !c.real_name;
                    const healthIcon = hasMissingData 
                        ? '<span title="Missing data" style="color: var(--warning);">⚠️</span>'
                        : '<span title="Complete" style="color: var(--success);">✓</span>';

                    return `<tr onclick="openCreatorDetail('${primaryAccount.replace(/'/g, "\\'")}', '${c.brand}')" style="cursor: pointer;">
                        <td onclick="event.stopPropagation();">
                            <input type="checkbox" class="bulk-checkbox" data-id="${c.id}" onchange="toggleRosterSelect(this, '${c.id}')">
                        </td>
                        <td>
                            <div class="creator-cell">
                                <div class="creator-avatar">${(c.real_name || c.discord_name || '?').charAt(0).toUpperCase()}</div>
                                <div>
                                    <span class="creator-name">${c.real_name || 'Unknown'}${multiBrandIndicator}</span>
                                    ${c.discord_name ? `<div style="font-size: 0.75rem; color: var(--text-muted);">${c.discord_name}</div>` : ''}
                                </div>
                            </div>
                        </td>
                        <td><span class="badge-brand">${BRAND_DISPLAY[c.brand] || c.brand}</span></td>
                        <td><span class="badge" style="${getStatusClass(creatorStatus)}">${creatorStatus}</span></td>
                        <td><span class="gmv-value ${c.gmv >= 1000 ? 'gmv-high' : ''}">${fmtMoney(c.gmv)}</span></td>
                        <td><span class="badge-tier ${c.tier.class}">${c.tier.name}</span></td>
                        <td style="font-size: 0.85rem;">${c.retainer > 0 ? `<span style="color: var(--success);">${fmtMoney(c.retainer)}</span>` : (c.retainer === 0 ? '<span class="badge" style="background: var(--blue-dim); color: var(--blue); font-size: 0.7rem;">Affiliate</span>' : '<span style="color: var(--text-muted);">−</span>')}</td>
                        <td style="font-size: 0.85rem; text-align: center;">${c.retainer > 0 ? (() => {
                            const roi = (c.gmv / c.retainer).toFixed(1);
                            const color = roi >= 1 ? 'var(--success)' : 'var(--error)';
                            return `<span style="color: ${color}; font-weight: 600;">${roi}x</span>`;
                        })() : '<span style="color: var(--text-muted);">−</span>'}</td>
                        <td style="text-align: center;">${healthIcon}</td>
                        <td style="font-size: 0.85rem; color: var(--text-muted);">${formatJoinedDate(c.created_at)}</td>
                        <td>
                            <button class="action-btn view" onclick="event.stopPropagation(); editCreator(${c.id})" title="Edit">✎</button>
                            <button class="action-btn remove" onclick="event.stopPropagation(); deleteCreator(${c.id}, '${(c.real_name || '').replace(/'/g, "\\'")}')" title="Delete">×</button>
                        </td>
                    </tr>`;
                }).join('') || '<tr><td colspan="11"><div class="empty-state"><h3>No creators in roster</h3><p>Add creators to start tracking their performance</p></div></td></tr>';

                renderPagination('rosterPagination', rosterWithPerf.length, pages.roster, (p) => { pages.roster = p; renderRosterTable(); });
            }
            
            // Update roster health check
            updateRosterHealthCheck();
        }

        // Helper functions for identity view
        function toggleCreatorExpand(row, discordName) {
            const detailId = `detail-${(discordName || '').replace(/[^a-zA-Z0-9]/g, '_')}`;
            const detailRow = document.getElementById(detailId);
            const icon = row.querySelector('.roster-expand-icon');
            
            if (detailRow) {
                const isHidden = detailRow.style.display === 'none';
                detailRow.style.display = isHidden ? 'table-row' : 'none';
                if (icon) icon.classList.toggle('expanded', isHidden);
            }
        }

        function logContactForCreator(identifier) {
            // Find all entries for this creator and log contact for all
            const entries = getCreatorByDiscord(identifier);
            if (entries.length === 0) {
                // Try by ID
                const entry = managedCreators.find(c => c.id === parseInt(identifier));
                if (entry) {
                    logContact(entry.id);
                }
                return;
            }
            
            // Log contact for the first entry (will update by discord)
            logContact(entries[0].id);
        }

        function addCreatorToBrand(discordName) {
            // Open add creator modal with Discord pre-filled
            openAddCreatorModal();
            if (discordName) {
                document.getElementById('creatorDiscord').value = discordName;
                checkExistingDiscord();
            }
        }

        // Quick merge two entries for the same brand
        async function quickMergeEntries(keepId, mergeId) {
            const keepEntry = managedCreators.find(c => c.id === keepId);
            const mergeEntry = managedCreators.find(c => c.id === mergeId);
            
            if (!keepEntry || !mergeEntry) {
                showToast('Could not find entries to merge', 'error');
                return;
            }
            
            // Collect accounts from merge entry
            const mergeAccounts = [mergeEntry.account_1, mergeEntry.account_2, mergeEntry.account_3, mergeEntry.account_4, mergeEntry.account_5].filter(a => a && a.trim());
            
            // Find available slots in keep entry
            const keepAccounts = [keepEntry.account_1, keepEntry.account_2, keepEntry.account_3, keepEntry.account_4, keepEntry.account_5];
            
            // Try to add merge accounts to empty slots
            let nextSlot = keepAccounts.findIndex(a => !a || !a.trim());
            const accountsToAdd = [];
            
            for (const acc of mergeAccounts) {
                // Skip if already exists in keep entry
                if (keepAccounts.some(k => k && normalizeTikTok(k) === normalizeTikTok(acc))) continue;
                
                if (nextSlot >= 0 && nextSlot < 5) {
                    accountsToAdd.push({ slot: nextSlot + 1, account: acc });
                    keepAccounts[nextSlot] = acc;
                    nextSlot = keepAccounts.findIndex(a => !a || !a.trim());
                }
            }
            
            // Build update object
            const updateData = {};
            accountsToAdd.forEach(a => {
                updateData['account_' + a.slot] = a.account;
            });
            
            // Also merge retainer if mergeEntry has one and keepEntry doesn't
            if (mergeEntry.retainer && !keepEntry.retainer) {
                updateData.retainer = mergeEntry.retainer;
            }
            
            // Merge notes
            if (mergeEntry.notes && mergeEntry.notes.trim()) {
                const existingNotes = keepEntry.notes || '';
                updateData.notes = existingNotes + (existingNotes ? '\n' : '') + '[Merged] ' + mergeEntry.notes;
            }
            
            const accountsAdded = accountsToAdd.length;
            const totalAccounts = mergeAccounts.length;
            
            // Confirm
            const confirmMsg = accountsAdded === totalAccounts 
                ? 'Merge @' + mergeEntry.account_1 + ' into this entry?\n\nThis will add ' + accountsAdded + ' account(s) and delete the duplicate entry.'
                : 'Merge @' + mergeEntry.account_1 + ' into this entry?\n\nOnly ' + accountsAdded + ' of ' + totalAccounts + ' accounts can be added (max 5 slots).\n\nThe duplicate entry will be deleted.';
            
            if (!confirm(confirmMsg)) return;
            
            try {
                // Update keep entry with new accounts
                if (Object.keys(updateData).length > 0) {
                    const { error: updateError } = await supabaseClient
                        .from('managed_creators')
                        .update(updateData)
                        .eq('id', keepId);
                    
                    if (updateError) throw updateError;
                }
                
                // Delete merge entry
                const { error: deleteError } = await supabaseClient
                    .from('managed_creators')
                    .delete()
                    .eq('id', mergeId);
                
                if (deleteError) throw deleteError;
                
                showToast('Merged! Added ' + accountsAdded + ' account(s)', 'success');
                logActivity('merge', 'Merged roster entries: @' + mergeEntry.account_1 + ' into @' + keepEntry.account_1, keepEntry.brand);
                
                // Refresh
                await loadManagedCreators();
                loadRosterData();
                
            } catch (err) {
                showToast('Error merging: ' + err.message, 'error');
                console.error(err);
            }
        }

        function toggleRosterSelectIdentity(checkbox) {
            const discord = checkbox.dataset.discord;
            // For identity view, select all entries with this discord
            const entries = getCreatorByDiscord(discord);
            entries.forEach(e => {
                const idStr = String(e.id);
                if (checkbox.checked) {
                    selectedRosterIds.add(idStr);
                } else {
                    selectedRosterIds.delete(idStr);
                }
            });
            updateRosterBulkUI();
        }

        async function bulkLogContact() {
            if (selectedRosterIds.size === 0) return;
            
            const today = new Date().toISOString().split('T')[0];
            const ids = [...selectedRosterIds].map(id => parseInt(id));
            const { error } = await supabaseClient.from('managed_creators')
                .update({ last_contact_date: today })
                .in('id', ids);
            
            if (error) {
                showToast('Error logging contact: ' + error.message, 'error');
                return;
            }
            
            showToast(`Logged contact for ${selectedRosterIds.size} entries`, 'success');
            clearRosterSelection();
            await loadManagedCreators();
            loadRosterData();
        }

        // Roster Health Check Functions
        let sameBrandDuplicates = []; // Store for merge modal
        
        function updateRosterHealthCheck() {
            const healthCheck = document.getElementById('rosterHealthCheck');
            if (!healthCheck) return;
            
            // Find creators with missing data
            const missingDiscord = managedCreators.filter(c => !c.discord_name || c.discord_name.trim() === '');
            const missingTikTok = managedCreators.filter(c => !c.account_1 || c.account_1.trim() === '');
            const missingName = managedCreators.filter(c => !c.real_name || c.real_name.trim() === '');
            
            // Find potential duplicates (same TikTok across entries in same brand)
            const duplicates = [];
            const seenAccounts = new Map();
            
            managedCreators.forEach(c => {
                const accounts = [c.account_1, c.account_2, c.account_3, c.account_4, c.account_5].filter(a => a);
                accounts.forEach(acc => {
                    const normalized = normalizeTikTok(acc);
                    if (!normalized) return;
                    const key = `${c.brand}:${normalized}`;
                    if (seenAccounts.has(key)) {
                        const existing = seenAccounts.get(key);
                        if (!duplicates.find(d => d.account === normalized && d.brand === c.brand)) {
                            duplicates.push({
                                account: normalized,
                                brand: c.brand,
                                creators: [existing, c]
                            });
                        }
                    } else {
                        seenAccounts.set(key, c);
                    }
                });
            });
            
            // Find same-brand duplicates (same Discord + same brand = needs merging)
            // These are creators who have multiple separate entries for the same brand
            sameBrandDuplicates = [];
            const discordBrandMap = new Map(); // discord:brand -> [entries]
            
            managedCreators.forEach(c => {
                if (!c.discord_name) return;
                const key = `${c.discord_name.toLowerCase().trim()}:${c.brand}`;
                if (!discordBrandMap.has(key)) {
                    discordBrandMap.set(key, []);
                }
                discordBrandMap.get(key).push(c);
            });
            
            discordBrandMap.forEach((entries, key) => {
                if (entries.length > 1) {
                    const [discord, brand] = key.split(':');
                    sameBrandDuplicates.push({
                        discord: entries[0].discord_name,
                        brand: brand,
                        entries: entries,
                        displayName: entries[0].real_name || entries[0].discord_name
                    });
                }
            });
            
            const hasIssues = missingDiscord.length > 0 || missingTikTok.length > 0 || missingName.length > 0 || duplicates.length > 0 || sameBrandDuplicates.length > 0;
            
            // Find creators missing discord_id (can still have discord_name)
            const missingDiscordId = managedCreators.filter(c => !c.discord_id || c.discord_id.trim() === '');
            
            // Show/hide health check section (always show if data integrity section is there)
            healthCheck.style.display = 'block';
            
            // Update summary badges
            const discordBadge = document.getElementById('healthMissingDiscord');
            const tiktokBadge = document.getElementById('healthMissingTikTok');
            const nameBadge = document.getElementById('healthMissingName');
            const dupBadge = document.getElementById('healthDuplicates');
            const sameBrandDupBadge = document.getElementById('healthSameBrandDupes');
            const discordIdBadge = document.getElementById('healthMissingDiscordId');
            
            if (missingDiscord.length > 0) {
                discordBadge.style.display = 'flex';
                document.getElementById('healthMissingDiscordCount').textContent = missingDiscord.length;
            } else {
                discordBadge.style.display = 'none';
            }
            
            if (missingTikTok.length > 0) {
                tiktokBadge.style.display = 'flex';
                document.getElementById('healthMissingTikTokCount').textContent = missingTikTok.length;
            } else {
                tiktokBadge.style.display = 'none';
            }
            
            if (missingName.length > 0) {
                nameBadge.style.display = 'flex';
                document.getElementById('healthMissingNameCount').textContent = missingName.length;
            } else {
                nameBadge.style.display = 'none';
            }
            
            if (missingDiscordId.length > 0) {
                discordIdBadge.style.display = 'flex';
                document.getElementById('healthMissingDiscordIdCount').textContent = missingDiscordId.length;
            } else {
                discordIdBadge.style.display = 'none';
            }
            
            if (duplicates.length > 0) {
                dupBadge.style.display = 'flex';
                document.getElementById('healthDuplicatesCount').textContent = duplicates.length;
            } else {
                dupBadge.style.display = 'none';
            }
            
            if (sameBrandDuplicates.length > 0) {
                sameBrandDupBadge.style.display = 'flex';
                document.getElementById('healthSameBrandDupesCount').textContent = sameBrandDuplicates.length;
            } else {
                sameBrandDupBadge.style.display = 'none';
            }
            
            // Populate detail lists
            const discordList = document.getElementById('healthMissingDiscordList');
            const discordItems = document.getElementById('healthMissingDiscordItems');
            if (missingDiscord.length > 0) {
                discordList.style.display = 'block';
                discordItems.innerHTML = missingDiscord.map(c => `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; background: var(--bg-secondary); border-radius: 6px; margin-bottom: 6px;">
                        <div>
                            <div style="font-weight: 500;">${c.real_name || c.account_1 || 'Unknown'}</div>
                            <div style="font-size: 0.8rem; color: var(--text-muted);">${BRAND_DISPLAY[c.brand] || c.brand}</div>
                        </div>
                        <button class="btn btn-secondary" onclick="editCreator(${c.id})" style="font-size: 0.75rem; padding: 4px 10px;">Fix</button>
                    </div>
                `).join('');
            } else {
                discordList.style.display = 'none';
            }
            
            const tiktokList = document.getElementById('healthMissingTikTokList');
            const tiktokItems = document.getElementById('healthMissingTikTokItems');
            if (missingTikTok.length > 0) {
                tiktokList.style.display = 'block';
                tiktokItems.innerHTML = missingTikTok.map(c => `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; background: var(--bg-secondary); border-radius: 6px; margin-bottom: 6px;">
                        <div>
                            <div style="font-weight: 500;">${c.real_name || c.discord_name || 'Unknown'}</div>
                            <div style="font-size: 0.8rem; color: var(--text-muted);">${BRAND_DISPLAY[c.brand] || c.brand}</div>
                        </div>
                        <button class="btn btn-secondary" onclick="editCreator(${c.id})" style="font-size: 0.75rem; padding: 4px 10px;">Fix</button>
                    </div>
                `).join('');
            } else {
                tiktokList.style.display = 'none';
            }
            
            const nameList = document.getElementById('healthMissingNameList');
            const nameItems = document.getElementById('healthMissingNameItems');
            if (missingName.length > 0) {
                nameList.style.display = 'block';
                nameItems.innerHTML = missingName.slice(0, 20).map(c => `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; background: var(--bg-secondary); border-radius: 6px; margin-bottom: 6px;">
                        <div>
                            <div style="font-weight: 500;">@${c.account_1 || '?'}</div>
                            <div style="font-size: 0.8rem; color: var(--text-muted);">${BRAND_DISPLAY[c.brand] || c.brand}${c.discord_name ? ' • ' + c.discord_name : ''}</div>
                        </div>
                        <button class="btn btn-secondary" onclick="editCreator(${c.id})" style="font-size: 0.75rem; padding: 4px 10px;">Fix</button>
                    </div>
                `).join('') + (missingName.length > 20 ? `<div style="padding: 8px; text-align: center; color: var(--text-muted);">+${missingName.length - 20} more</div>` : '');
            } else {
                nameList.style.display = 'none';
            }
            
            const dupList = document.getElementById('healthDuplicatesList');
            const dupItems = document.getElementById('healthDuplicatesItems');
            if (duplicates.length > 0) {
                dupList.style.display = 'block';
                dupItems.innerHTML = duplicates.map(d => `
                    <div style="padding: 8px; background: var(--bg-secondary); border-radius: 6px; margin-bottom: 6px;">
                        <div style="font-weight: 500;">@${d.account}</div>
                        <div style="font-size: 0.8rem; color: var(--text-muted);">${BRAND_DISPLAY[d.brand] || d.brand} - ${d.creators.length} entries</div>
                    </div>
                `).join('');
            } else {
                dupList.style.display = 'none';
            }
            
            // Missing Discord ID list
            const discordIdList = document.getElementById('healthMissingDiscordIdList');
            const discordIdItems = document.getElementById('healthMissingDiscordIdItems');
            if (missingDiscordId.length > 0) {
                discordIdList.style.display = 'block';
                discordIdItems.innerHTML = missingDiscordId.slice(0, 15).map(c => `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; background: var(--bg-secondary); border-radius: 6px; margin-bottom: 6px;">
                        <div>
                            <div style="font-weight: 500;">${c.real_name || c.discord_name || c.account_1 || 'Unknown'}</div>
                            <div style="font-size: 0.8rem; color: var(--text-muted);">${BRAND_DISPLAY[c.brand] || c.brand}${c.discord_name ? ' • ' + c.discord_name : ''}</div>
                        </div>
                        <span style="font-size: 0.7rem; color: var(--text-muted);">Needs Discord login</span>
                    </div>
                `).join('') + (missingDiscordId.length > 15 ? `<div style="padding: 8px; text-align: center; color: var(--text-muted);">+${missingDiscordId.length - 15} more</div>` : '');
            } else {
                discordIdList.style.display = 'none';
            }
            
            // Trigger data integrity check
            runDataIntegrityCheck();
        }
        
        // Data integrity check - measures linking quality
        async function runDataIntegrityCheck() {
            try {
                // Check performance data linking
                const { data: perfStats } = await supabaseClient
                    .from('creator_performance')
                    .select('managed_creator_id', { count: 'exact', head: false });
                
                const totalPerf = perfStats?.length || 0;
                const linkedPerf = perfStats?.filter(p => p.managed_creator_id)?.length || 0;
                const linkedPct = totalPerf > 0 ? Math.round((linkedPerf / totalPerf) * 100) : 0;
                
                document.getElementById('integrityLinkedPct').textContent = linkedPct + '%';
                document.getElementById('integrityLinkedPct').style.color = linkedPct >= 90 ? 'var(--success)' : linkedPct >= 70 ? 'var(--warning)' : 'var(--danger)';
                
                const orphaned = totalPerf - linkedPerf;
                document.getElementById('integrityOrphaned').textContent = orphaned.toLocaleString();
                document.getElementById('integrityOrphaned').style.color = orphaned === 0 ? 'var(--success)' : orphaned < 1000 ? 'var(--warning)' : 'var(--danger)';
                
                // Update orphaned badge
                const orphanedBadge = document.getElementById('healthOrphanedPerf');
                if (orphaned > 0) {
                    orphanedBadge.style.display = 'flex';
                    document.getElementById('healthOrphanedPerfCount').textContent = orphaned.toLocaleString();
                } else {
                    orphanedBadge.style.display = 'none';
                }
                
                // Discord ID coverage
                const withDiscordId = managedCreators.filter(c => c.discord_id && c.discord_id.trim() !== '').length;
                const discordIdPct = managedCreators.length > 0 ? Math.round((withDiscordId / managedCreators.length) * 100) : 0;
                document.getElementById('integrityDiscordIdPct').textContent = discordIdPct + '%';
                document.getElementById('integrityDiscordIdPct').style.color = discordIdPct >= 90 ? 'var(--success)' : discordIdPct >= 70 ? 'var(--warning)' : 'var(--info)';
                
                // TikTok accounts count (check if table exists)
                const { data: tiktokData, error: tiktokError } = await supabaseClient
                    .from('tiktok_accounts')
                    .select('id', { count: 'exact', head: true });
                
                if (!tiktokError) {
                    const tiktokCount = tiktokData?.length || 0;
                    document.getElementById('integrityTikTokAccounts').textContent = tiktokCount.toLocaleString();
                } else {
                    // Table doesn't exist yet
                    document.getElementById('integrityTikTokAccounts').textContent = 'N/A';
                    document.getElementById('integrityTikTokAccounts').style.color = 'var(--text-muted)';
                }
                
            } catch (err) {
                console.error('Error running data integrity check:', err);
            }
        }
        
        // Show orphaned data modal
        async function showOrphanedDataModal() {
            // For now, just show a toast with options
            const result = await new Promise(resolve => {
                const modal = document.createElement('div');
                modal.className = 'modal-overlay show';
                modal.innerHTML = `
                    <div class="modal" style="max-width: 500px;">
                        <div class="modal-header">
                            <h3 class="modal-title">📊 Unlinked Performance Data</h3>
                            <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
                        </div>
                        <div class="modal-body">
                            <p style="margin-bottom: 16px;">Performance data exists that isn't linked to any roster entry. This happens when:</p>
                            <ul style="margin-bottom: 16px; padding-left: 20px; color: var(--text-secondary);">
                                <li>Creator not added to roster yet</li>
                                <li>TikTok handle differs from roster entry</li>
                                <li>Data uploaded before migration</li>
                            </ul>
                            <p style="margin-bottom: 16px;">You can:</p>
                            <div style="display: flex; flex-direction: column; gap: 12px;">
                                <button class="btn btn-primary" onclick="backfillPerformanceLinks(); this.closest('.modal-overlay').remove();">
                                    🔗 Auto-Link Now
                                </button>
                                <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove();">
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                `;
                document.body.appendChild(modal);
            });
        }
        
        // Backfill performance links using RPC or fallback
        async function backfillPerformanceLinks() {
            showToast('Linking performance data...', 'info');
            
            try {
                // Try RPC function first
                const { data, error } = await supabaseClient.rpc('backfill_performance_links');
                
                if (!error && data) {
                    const total = data.reduce((sum, d) => sum + d.linked_count, 0);
                    showToast(`Linked ${total} records across ${data.length} brands!`, 'success');
                    runDataIntegrityCheck();
                    return;
                }
                
                // Fallback: Manual linking per brand
                const brands = [...new Set(managedCreators.map(c => c.brand))];
                let totalLinked = 0;
                
                for (const brand of brands) {
                    // Get all tiktok handles for this brand
                    const brandCreators = managedCreators.filter(c => c.brand === brand);
                    const handles = [];
                    brandCreators.forEach(c => {
                        [c.account_1, c.account_2, c.account_3, c.account_4, c.account_5].forEach(acc => {
                            if (acc) handles.push({ handle: normalizeTikTok(acc), id: c.id });
                        });
                    });
                    
                    // Update performance records
                    for (const { handle, id } of handles) {
                        const { count } = await supabaseClient
                            .from('creator_performance')
                            .update({ managed_creator_id: id })
                            .eq('brand', brand)
                            .ilike('creator_name', handle)
                            .is('managed_creator_id', null);
                        
                        totalLinked += count || 0;
                    }
                }
                
                showToast(`Linked ${totalLinked} records!`, 'success');
                runDataIntegrityCheck();
                
            } catch (err) {
                console.error('Error backfilling links:', err);
                showToast('Error linking data: ' + err.message, 'error');
            }
        }
        
        function toggleRosterHealthDetails() {
            const details = document.getElementById('rosterHealthDetails');
            const toggleText = document.getElementById('rosterHealthToggleText');
            
            if (details.style.display === 'none') {
                details.style.display = 'block';
                toggleText.textContent = 'Hide Details';
            } else {
                details.style.display = 'none';
                toggleText.textContent = 'Show Details';
            }
        }
        
        // ==================== MERGE ENTRIES TOOL ====================
        function openMergeEntriesModal() {
            document.getElementById('mergeEntriesModal').classList.add('show');
            renderMergeEntriesList();
        }
        
        function closeMergeEntriesModal() {
            document.getElementById('mergeEntriesModal').classList.remove('show');
        }
        
        function renderMergeEntriesList() {
            const container = document.getElementById('mergeEntriesList');
            
            if (sameBrandDuplicates.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <h3>✅ No duplicates found</h3>
                        <p>All your creators have unique entries per brand.</p>
                    </div>
                `;
                return;
            }
            
            container.innerHTML = sameBrandDuplicates.map((dup, idx) => {
                // Sort entries by GMV (highest first) to suggest primary
                const sortedEntries = [...dup.entries].sort((a, b) => {
                    const gmvA = rosterCache.withPerformance?.find(r => r.id === a.id)?.gmv || 0;
                    const gmvB = rosterCache.withPerformance?.find(r => r.id === b.id)?.gmv || 0;
                    return gmvB - gmvA;
                });
                
                const accounts = sortedEntries.map(e => ({
                    id: e.id,
                    account: e.account_1,
                    gmv: rosterCache.withPerformance?.find(r => r.id === e.id)?.gmv || 0,
                    role: e.role,
                    retainer: e.retainer || 0
                })).filter(a => a.account);
                
                const totalGmv = accounts.reduce((s, a) => s + a.gmv, 0);
                const totalRetainer = sortedEntries.reduce((s, e) => s + (e.retainer || 0), 0);
                
                return `
                    <div class="merge-group" style="background: var(--bg-secondary); border-radius: 12px; padding: 16px; margin-bottom: 16px; border: 1px solid var(--border);">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                            <div>
                                <div style="font-weight: 600; font-size: 1.1rem;">${dup.displayName}</div>
                                <div style="font-size: 0.85rem; color: var(--text-muted);">
                                    <span class="badge-brand">${BRAND_DISPLAY[dup.brand] || dup.brand}</span>
                                    <span style="margin-left: 8px;">${dup.entries.length} separate entries</span>
                                </div>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-weight: 600; color: var(--success);">${fmtMoney(totalGmv)}</div>
                                <div style="font-size: 0.8rem; color: var(--text-muted);">Combined GMV</div>
                            </div>
                        </div>
                        
                        <div style="background: var(--bg-primary); border-radius: 8px; padding: 12px; margin-bottom: 12px;">
                            <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted); margin-bottom: 8px;">Accounts to Merge</div>
                            ${accounts.map((a, i) => `
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; ${i < accounts.length - 1 ? 'border-bottom: 1px solid var(--border);' : ''}">
                                    <div style="display: flex; align-items: center; gap: 8px;">
                                        <input type="checkbox" checked data-merge-group="${idx}" data-entry-id="${a.id}" data-account="${a.account || ''}" class="merge-account-checkbox">
                                        <span style="font-weight: 500;">@${a.account || '?'}</span>
                                        ${i === 0 ? '<span style="font-size: 0.7rem; background: var(--success-dim); color: var(--success); padding: 2px 6px; border-radius: 4px;">PRIMARY</span>' : ''}
                                    </div>
                                    <span style="font-weight: 500; ${a.gmv > 0 ? 'color: var(--success);' : ''}">${fmtMoney(a.gmv)}</span>
                                </div>
                            `).join('')}
                            ${totalRetainer > 0 ? `<div style="margin-top: 8px; font-size: 0.85rem; color: var(--text-muted);">Total Retainer: <strong style="color: var(--accent);">${fmtMoney(totalRetainer)}/mo</strong></div>` : ''}
                        </div>
                        
                        <button class="btn btn-primary" onclick="executeMerge(${idx})" style="width: 100%;">
                            🔀 Merge ${accounts.length} accounts into 1 entry
                        </button>
                    </div>
                `;
            }).join('');
        }
        
        async function executeMerge(groupIdx) {
            const dup = sameBrandDuplicates[groupIdx];
            if (!dup) return;
            
            // Get checked accounts
            const checkboxes = document.querySelectorAll(`input[data-merge-group="${groupIdx}"]:checked`);
            const selectedAccounts = [...checkboxes].map(cb => cb.dataset.account).filter(a => a && a !== 'undefined');
            
            if (selectedAccounts.length === 0) {
                showToast('Please select at least one account to keep', 'error');
                return;
            }
            
            // Sort entries by GMV to find primary (keep the one with highest GMV)
            const sortedEntries = [...dup.entries].sort((a, b) => {
                const gmvA = rosterCache.withPerformance?.find(r => r.id === a.id)?.gmv || 0;
                const gmvB = rosterCache.withPerformance?.find(r => r.id === b.id)?.gmv || 0;
                return gmvB - gmvA;
            });
            
            const primaryEntry = sortedEntries[0];
            const entriesToDelete = sortedEntries.slice(1);
            
            // Collect all unique accounts from all entries
            const allAccounts = new Set();
            sortedEntries.forEach(e => {
                [e.account_1, e.account_2, e.account_3, e.account_4, e.account_5].forEach(a => {
                    if (a && a.trim()) allAccounts.add(a.trim());
                });
            });
            
            // Only keep selected accounts
            const accountsToKeep = [...allAccounts].filter(a => selectedAccounts.includes(a));
            
            if (accountsToKeep.length > 5) {
                showToast('Cannot merge: more than 5 accounts. Please uncheck some.', 'error');
                return;
            }
            
            // Sum up retainers
            const totalRetainer = sortedEntries.reduce((s, e) => s + (e.retainer || 0), 0);
            
            // Prepare update for primary entry
            const updateData = {
                account_1: accountsToKeep[0] || null,
                account_2: accountsToKeep[1] || null,
                account_3: accountsToKeep[2] || null,
                account_4: accountsToKeep[3] || null,
                account_5: accountsToKeep[4] || null,
                retainer: totalRetainer
            };
            
            // Use best available name
            if (!primaryEntry.real_name) {
                const entryWithName = sortedEntries.find(e => e.real_name);
                if (entryWithName) updateData.real_name = entryWithName.real_name;
            }
            
            // Confirm before proceeding
            if (!confirm(`Merge ${dup.entries.length} entries into 1?\n\nPrimary entry: @${primaryEntry.account_1 || '?'}\nAccounts to keep: ${accountsToKeep.join(', ')}\nEntries to delete: ${entriesToDelete.length}`)) {
                return;
            }
            
            try {
                // Update primary entry with all accounts
                const { error: updateError } = await supabaseClient
                    .from('managed_creators')
                    .update(updateData)
                    .eq('id', primaryEntry.id);
                
                if (updateError) throw updateError;
                
                // Delete other entries
                if (entriesToDelete.length > 0) {
                    const idsToDelete = entriesToDelete.map(e => e.id);
                    const { error: deleteError } = await supabaseClient
                        .from('managed_creators')
                        .delete()
                        .in('id', idsToDelete);
                    
                    if (deleteError) throw deleteError;
                }
                
                showToast(`Merged ${dup.entries.length} entries into 1`, 'success');
                
                // Refresh data
                await loadManagedCreators();
                loadRosterData();
                
                // Re-render merge list
                renderMergeEntriesList();
                
            } catch (err) {
                showToast('Error merging: ' + err.message, 'error');
            }
        }

        // ==================== SMART MATCH TOOL ====================
        let smartMatchData = {
            orphanPerformance: [],  // TikTok handles with GMV but not in managed_creators
            missingDiscord: [],     // Managed creators missing Discord
            missingTikTok: [],      // Managed creators missing TikTok
            missingName: [],        // Managed creators missing real_name
            duplicates: [],         // Potential duplicate entries
            selectedMatches: new Map()  // id -> { type, data }
        };
        let currentSmartMatchTab = 'orphanPerformance';

        function openSmartMatchModal() {
            document.getElementById('smartMatchModal').classList.add('show');
            runSmartMatch();
        }

        function closeSmartMatchModal() {
            document.getElementById('smartMatchModal').classList.remove('show');
            smartMatchData.selectedMatches.clear();
            updateSmartMatchSelectedCount();
        }

        function switchSmartMatchTab(tab) {
            currentSmartMatchTab = tab;
            document.querySelectorAll('.smart-match-tab').forEach(t => t.classList.remove('active'));
            document.getElementById('tabOrphanPerformance').classList.toggle('active', tab === 'orphanPerformance');
            document.getElementById('tabMissingDiscord').classList.toggle('active', tab === 'missingDiscord');
            document.getElementById('tabMissingTikTok').classList.toggle('active', tab === 'missingTikTok');
            document.getElementById('tabMissingName').classList.toggle('active', tab === 'missingName');
            document.getElementById('tabDuplicates').classList.toggle('active', tab === 'duplicates');
            renderSmartMatchResults();
        }

        async function runSmartMatch() {
            const resultsContainer = document.getElementById('smartMatchResults');
            resultsContainer.innerHTML = '<div class="loading"><div class="spinner"></div> Analyzing data...</div>';
            
            const brandFilter = document.getElementById('smartMatchBrandFilter').value;
            
            try {
                // Get all TikTok handles currently in managed_creators
                const managedHandles = new Set();
                managedCreators.forEach(mc => {
                    [mc.account_1, mc.account_2, mc.account_3, mc.account_4, mc.account_5].forEach(acc => {
                        if (acc) managedHandles.add(normalizeTikTok(acc));
                    });
                });

                // Fetch all creator performance data to find orphans
                let allPerfData = [];
                let page = 0;
                const pageSize = QUERY_PAGE_SIZE;
                let hasMore = true;
                
                // Get last 30 days for relevance
                const endDate = new Date();
                const startDate = new Date();
                startDate.setDate(startDate.getDate() - 30);
                
                while (hasMore) {
                    let query = supabaseClient.from('creator_performance')
                        .select('creator_name, brand, gmv, orders')
                        .gte('report_date', startDate.toISOString().split('T')[0])
                        .lte('report_date', endDate.toISOString().split('T')[0])
                        .eq('period_type', 'daily')
                        .range(page * pageSize, (page + 1) * pageSize - 1);
                    
                    if (brandFilter !== 'all') query = query.eq('brand', brandFilter);
                    
                    const { data, error } = await query;
                    if (error || !data || data.length === 0) {
                        hasMore = false;
                    } else {
                        allPerfData = allPerfData.concat(data);
                        hasMore = data.length === pageSize;
                        page++;
                    }
                    if (page >= MAX_PAGES) break;
                }

                // Aggregate performance by creator+brand
                const perfMap = new Map();
                allPerfData.forEach(row => {
                    const normalized = normalizeTikTok(row.creator_name);
                    if (!normalized) return;
                    const key = `${normalized}|||${row.brand}`;
                    if (!perfMap.has(key)) {
                        perfMap.set(key, { 
                            creator_name: row.creator_name, 
                            normalized,
                            brand: row.brand, 
                            gmv: 0, 
                            orders: 0 
                        });
                    }
                    const p = perfMap.get(key);
                    p.gmv += pFloat(row.gmv);
                    p.orders += pInt(row.orders);
                });

                // Find orphan performance (not managed for THAT brand)
                smartMatchData.orphanPerformance = [...perfMap.values()]
                    .filter(p => !isManagedForBrand(p.creator_name, p.brand) && p.gmv >= 100)
                    .sort((a, b) => b.gmv - a.gmv);

                // Find managed creators missing Discord
                smartMatchData.missingDiscord = managedCreators
                    .filter(mc => !mc.discord_name || mc.discord_name.trim() === '')
                    .filter(mc => brandFilter === 'all' || mc.brand === brandFilter);

                // Find managed creators missing TikTok
                smartMatchData.missingTikTok = managedCreators
                    .filter(mc => !mc.account_1 || mc.account_1.trim() === '')
                    .filter(mc => brandFilter === 'all' || mc.brand === brandFilter)
                    .map(mc => ({
                        ...mc,
                        // Try to find potential matches based on name similarity
                        potentialMatches: findPotentialTikTokMatches(mc, perfMap)
                    }));

                // Find managed creators missing name
                smartMatchData.missingName = managedCreators
                    .filter(mc => !mc.real_name || mc.real_name.trim() === '')
                    .filter(mc => brandFilter === 'all' || mc.brand === brandFilter);

                // Find duplicates
                smartMatchData.duplicates = findDuplicates(brandFilter);

                // Update tab counts
                document.getElementById('orphanPerformanceCount').textContent = smartMatchData.orphanPerformance.length;
                document.getElementById('missingDiscordTabCount').textContent = smartMatchData.missingDiscord.length;
                document.getElementById('missingTikTokTabCount').textContent = smartMatchData.missingTikTok.length;
                document.getElementById('missingNameTabCount').textContent = smartMatchData.missingName.length;
                document.getElementById('duplicatesTabCount').textContent = smartMatchData.duplicates.length;

                renderSmartMatchResults();
            } catch (err) {
                resultsContainer.innerHTML = `<div class="empty-state"><p>Error: ${err.message}</p></div>`;
            }
        }

        function findPotentialTikTokMatches(managedCreator, perfMap) {
            // Try to match based on discord name or real name similarity
            const matches = [];
            const searchTerms = [
                managedCreator.discord_name?.toLowerCase(),
                managedCreator.real_name?.toLowerCase()
            ].filter(t => t && t.length > 2);
            
            if (searchTerms.length === 0) return matches;

            perfMap.forEach((perf, key) => {
                if (perf.brand !== managedCreator.brand) return;
                
                const handle = perf.normalized.toLowerCase();
                let score = 0;
                
                searchTerms.forEach(term => {
                    // Exact match
                    if (handle === term) score += 100;
                    // Contains
                    else if (handle.includes(term) || term.includes(handle)) score += 50;
                    // Fuzzy match (first 4 chars)
                    else if (term.length >= 4 && handle.includes(term.substring(0, 4))) score += 25;
                });
                
                if (score > 0) {
                    matches.push({ ...perf, score });
                }
            });

            return matches.sort((a, b) => b.score - a.score).slice(0, 3);
        }

        function findDuplicates(brandFilter) {
            const duplicates = [];
            const seen = {
                tiktok: new Map(),  // brand:handle -> creator
                discord: new Map(), // brand:discord -> creator
                email: new Map()    // brand:email -> creator
            };
            
            const creatorsToCheck = brandFilter === 'all' 
                ? managedCreators 
                : managedCreators.filter(mc => mc.brand === brandFilter);
            
            creatorsToCheck.forEach(c => {
                // Check TikTok handles
                [c.account_1, c.account_2, c.account_3, c.account_4, c.account_5].forEach(acc => {
                    if (!acc) return;
                    const normalized = normalizeTikTok(acc);
                    if (!normalized) return;
                    const key = `${c.brand}:${normalized}`;
                    
                    if (seen.tiktok.has(key)) {
                        const existing = seen.tiktok.get(key);
                        // Check if this pair already exists
                        const existingDup = duplicates.find(d => 
                            d.type === 'tiktok' && 
                            d.matchValue === normalized && 
                            d.brand === c.brand
                        );
                        if (!existingDup) {
                            duplicates.push({
                                type: 'tiktok',
                                matchValue: normalized,
                                brand: c.brand,
                                creators: [existing, c]
                            });
                        } else if (!existingDup.creators.find(cr => cr.id === c.id)) {
                            existingDup.creators.push(c);
                        }
                    } else {
                        seen.tiktok.set(key, c);
                    }
                });
                
                // Check Discord
                if (c.discord_name && c.discord_name.trim()) {
                    const key = `${c.brand}:${c.discord_name.toLowerCase().trim()}`;
                    if (seen.discord.has(key)) {
                        const existing = seen.discord.get(key);
                        const existingDup = duplicates.find(d => 
                            d.type === 'discord' && 
                            d.matchValue.toLowerCase() === c.discord_name.toLowerCase().trim() && 
                            d.brand === c.brand
                        );
                        if (!existingDup) {
                            duplicates.push({
                                type: 'discord',
                                matchValue: c.discord_name,
                                brand: c.brand,
                                creators: [existing, c]
                            });
                        } else if (!existingDup.creators.find(cr => cr.id === c.id)) {
                            existingDup.creators.push(c);
                        }
                    } else {
                        seen.discord.set(key, c);
                    }
                }
                
                // Check Email
                if (c.email && c.email.trim()) {
                    const key = `${c.brand}:${c.email.toLowerCase().trim()}`;
                    if (seen.email.has(key)) {
                        const existing = seen.email.get(key);
                        const existingDup = duplicates.find(d => 
                            d.type === 'email' && 
                            d.matchValue.toLowerCase() === c.email.toLowerCase().trim() && 
                            d.brand === c.brand
                        );
                        if (!existingDup) {
                            duplicates.push({
                                type: 'email',
                                matchValue: c.email,
                                brand: c.brand,
                                creators: [existing, c]
                            });
                        } else if (!existingDup.creators.find(cr => cr.id === c.id)) {
                            existingDup.creators.push(c);
                        }
                    } else {
                        seen.email.set(key, c);
                    }
                }
            });
            
            return duplicates;
        }

        function renderSmartMatchResults() {
            const container = document.getElementById('smartMatchResults');
            const search = document.getElementById('smartMatchSearch').value.toLowerCase();
            
            if (currentSmartMatchTab === 'orphanPerformance') {
                let data = smartMatchData.orphanPerformance;
                if (search) data = data.filter(p => p.creator_name.toLowerCase().includes(search));
                
                if (data.length === 0) {
                    container.innerHTML = '<div class="empty-state" style="padding: 40px;"><h3>🎉 No orphan performance data</h3><p>All creators with GMV are already in your roster</p></div>';
                    return;
                }

                container.innerHTML = `
                    <div style="margin-bottom: 16px; color: var(--text-muted); font-size: 0.9rem;">
                        These TikTok handles have GMV in the last 30 days but aren't in your managed roster. 
                        Select any you want to add as new managed creators.
                    </div>
                    ${data.slice(0, 50).map(p => `
                        <div class="match-card ${smartMatchData.selectedMatches.has('orphan-' + p.normalized + '-' + p.brand) ? 'selected' : ''}" 
                             onclick="toggleOrphanSelection('${p.normalized}', '${p.brand}', '${p.creator_name.replace(/'/g, "\\'")}')"
                             style="cursor: pointer;">
                            <div class="match-card-header">
                                <div>
                                    <div style="font-weight: 600; font-size: 1.1rem;">@${p.creator_name}</div>
                                    <div style="color: var(--text-muted); font-size: 0.85rem;">${BRAND_DISPLAY[p.brand] || p.brand}</div>
                                </div>
                                <div style="text-align: right;">
                                    <div style="font-weight: 700; color: var(--success); font-size: 1.1rem;">${fmtMoney(p.gmv)}</div>
                                    <div style="color: var(--text-muted); font-size: 0.8rem;">${p.orders} orders</div>
                                </div>
                            </div>
                            <div style="display: flex; gap: 8px;">
                                <button class="btn btn-sm ${smartMatchData.selectedMatches.has('orphan-' + p.normalized + '-' + p.brand) ? 'btn-primary' : 'btn-secondary'}" 
                                        style="font-size: 0.8rem; padding: 4px 12px;">
                                    ${smartMatchData.selectedMatches.has('orphan-' + p.normalized + '-' + p.brand) ? '✓ Selected' : 'Select to Add'}
                                </button>
                                <button class="btn btn-secondary" onclick="event.stopPropagation(); quickAddToRoster('${p.creator_name.replace(/'/g, "\\'")}', '${p.brand}'); closeSmartMatchModal();" 
                                        style="font-size: 0.8rem; padding: 4px 12px;">
                                    Quick Add →
                                </button>
                            </div>
                        </div>
                    `).join('')}
                    ${data.length > 50 ? `<div style="padding: 16px; text-align: center; color: var(--text-muted);">Showing 50 of ${data.length} results</div>` : ''}
                `;
            } else if (currentSmartMatchTab === 'missingDiscord') {
                let data = smartMatchData.missingDiscord;
                if (search) data = data.filter(mc => 
                    (mc.real_name || '').toLowerCase().includes(search) || 
                    (mc.account_1 || '').toLowerCase().includes(search)
                );
                
                if (data.length === 0) {
                    container.innerHTML = '<div class="empty-state" style="padding: 40px;"><h3>🎉 No missing Discord</h3><p>All managed creators have Discord names assigned</p></div>';
                    return;
                }

                container.innerHTML = `
                    <div style="margin-bottom: 16px; color: var(--text-muted); font-size: 0.9rem;">
                        These managed creators are missing Discord usernames. Discord is used as the primary identity key for grouping creators across brands.
                    </div>
                    ${data.slice(0, 50).map(mc => `
                        <div class="match-card">
                            <div class="match-card-header">
                                <div>
                                    <div style="font-weight: 600; font-size: 1.1rem;">${mc.real_name || '@' + (mc.account_1 || 'Unknown')}</div>
                                    <div style="color: var(--text-muted); font-size: 0.85rem;">
                                        ${mc.account_1 ? '@' + mc.account_1 + ' • ' : ''}${BRAND_DISPLAY[mc.brand] || mc.brand}
                                    </div>
                                </div>
                                <button class="btn btn-secondary" onclick="editCreator(${mc.id})" style="font-size: 0.8rem; padding: 4px 12px;">
                                    Edit
                                </button>
                            </div>
                        </div>
                    `).join('')}
                    ${data.length > 50 ? `<div style="padding: 16px; text-align: center; color: var(--text-muted);">Showing 50 of ${data.length} results</div>` : ''}
                `;
            } else if (currentSmartMatchTab === 'missingTikTok') {
                let data = smartMatchData.missingTikTok;
                if (search) data = data.filter(mc => 
                    (mc.real_name || '').toLowerCase().includes(search) || 
                    (mc.discord_name || '').toLowerCase().includes(search)
                );
                
                if (data.length === 0) {
                    container.innerHTML = '<div class="empty-state" style="padding: 40px;"><h3>🎉 No missing TikTok handles</h3><p>All managed creators have TikTok handles assigned</p></div>';
                    return;
                }

                container.innerHTML = `
                    <div style="margin-bottom: 16px; color: var(--text-muted); font-size: 0.9rem;">
                        These managed creators are missing TikTok handles. We've suggested potential matches based on name similarity.
                    </div>
                    ${data.slice(0, 50).map(mc => `
                        <div class="match-card">
                            <div class="match-card-header">
                                <div>
                                    <div style="font-weight: 600; font-size: 1.1rem;">${mc.real_name || 'Unknown'}</div>
                                    <div style="color: var(--text-muted); font-size: 0.85rem;">
                                        ${mc.discord_name ? '💬 ' + mc.discord_name + ' • ' : ''}${BRAND_DISPLAY[mc.brand] || mc.brand}
                                    </div>
                                </div>
                                <button class="btn btn-secondary" onclick="editCreator(${mc.id})" style="font-size: 0.8rem; padding: 4px 12px;">
                                    Edit
                                </button>
                            </div>
                            ${mc.potentialMatches.length > 0 ? `
                                <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border);">
                                    <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 8px;">Potential matches:</div>
                                    <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                                        ${mc.potentialMatches.map(match => `
                                            <button class="btn btn-secondary" 
                                                    onclick="event.stopPropagation(); linkTikTokToCreator(${mc.id}, '${match.creator_name.replace(/'/g, "\\'")}')"
                                                    style="font-size: 0.8rem; padding: 6px 12px; display: flex; align-items: center; gap: 6px;">
                                                <span>@${match.creator_name}</span>
                                                <span style="color: var(--success);">${fmtMoney(match.gmv)}</span>
                                                <span class="match-confidence ${match.score >= 50 ? 'high' : match.score >= 25 ? 'medium' : 'low'}">${match.score}%</span>
                                            </button>
                                        `).join('')}
                                    </div>
                                </div>
                            ` : `
                                <div style="margin-top: 12px; padding: 12px; background: var(--bg-tertiary); border-radius: 6px; color: var(--text-muted); font-size: 0.85rem;">
                                    No automatic matches found. Try searching manually or edit to add TikTok handle.
                                </div>
                            `}
                        </div>
                    `).join('')}
                    ${data.length > 50 ? `<div style="padding: 16px; text-align: center; color: var(--text-muted);">Showing 50 of ${data.length} results</div>` : ''}
                `;
            } else if (currentSmartMatchTab === 'missingName') {
                let data = smartMatchData.missingName;
                if (search) data = data.filter(mc => 
                    (mc.account_1 || '').toLowerCase().includes(search) || 
                    (mc.discord_name || '').toLowerCase().includes(search)
                );
                
                if (data.length === 0) {
                    container.innerHTML = '<div class="empty-state" style="padding: 40px;"><h3>🎉 No missing names</h3><p>All managed creators have names assigned</p></div>';
                    return;
                }

                container.innerHTML = `
                    <div style="margin-bottom: 16px; color: var(--text-muted); font-size: 0.9rem;">
                        These managed creators are missing real names. Click edit to add their name, or use their TikTok handle as the name.
                    </div>
                    ${data.slice(0, 50).map(mc => `
                        <div class="match-card" style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <div style="font-weight: 600; font-size: 1.1rem;">@${mc.account_1 || '?'}</div>
                                <div style="color: var(--text-muted); font-size: 0.85rem;">
                                    ${mc.discord_name ? '💬 ' + mc.discord_name + ' • ' : ''}${BRAND_DISPLAY[mc.brand] || mc.brand}
                                </div>
                            </div>
                            <div style="display: flex; gap: 8px;">
                                <button class="btn btn-secondary" onclick="useHandleAsName(${mc.id}, '${(mc.account_1 || '').replace(/'/g, "\\'")}')" 
                                        style="font-size: 0.8rem; padding: 4px 12px;">
                                    Use Handle as Name
                                </button>
                                <button class="btn btn-secondary" onclick="editCreator(${mc.id})" style="font-size: 0.8rem; padding: 4px 12px;">
                                    Edit
                                </button>
                            </div>
                        </div>
                    `).join('')}
                    ${data.length > 50 ? `<div style="padding: 16px; text-align: center; color: var(--text-muted);">Showing 50 of ${data.length} results</div>` : ''}
                `;
            } else if (currentSmartMatchTab === 'duplicates') {
                let data = smartMatchData.duplicates;
                if (search) data = data.filter(d => 
                    d.matchValue.toLowerCase().includes(search) ||
                    d.creators.some(c => 
                        (c.real_name || '').toLowerCase().includes(search) ||
                        (c.discord_name || '').toLowerCase().includes(search)
                    )
                );
                
                if (data.length === 0) {
                    container.innerHTML = '<div class="empty-state" style="padding: 40px;"><h3>🎉 No duplicates found</h3><p>Your roster data is clean!</p></div>';
                    return;
                }

                const typeIcons = { tiktok: '📱', discord: '💬', email: '📧' };
                const typeLabels = { tiktok: 'Same TikTok', discord: 'Same Discord', email: 'Same Email' };

                container.innerHTML = `
                    <div style="margin-bottom: 16px; color: var(--text-muted); font-size: 0.9rem;">
                        These entries appear to be duplicates based on matching identifiers. Review and merge or delete as needed.
                    </div>
                    ${data.map((d, idx) => `
                        <div class="match-card">
                            <div class="match-card-header">
                                <div>
                                    <div style="display: flex; align-items: center; gap: 8px;">
                                        <span style="font-size: 1.2rem;">${typeIcons[d.type]}</span>
                                        <span style="font-weight: 600;">${typeLabels[d.type]}: ${d.matchValue}</span>
                                    </div>
                                    <div style="color: var(--text-muted); font-size: 0.85rem; margin-top: 4px;">
                                        ${BRAND_DISPLAY[d.brand] || d.brand} • ${d.creators.length} entries
                                    </div>
                                </div>
                            </div>
                            <div style="margin-top: 16px; display: grid; gap: 12px;">
                                ${d.creators.map((c, cIdx) => `
                                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: var(--bg-tertiary); border-radius: 8px; ${cIdx === 0 ? 'border: 2px solid var(--accent);' : ''}">
                                        <div style="flex: 1;">
                                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                                                <span style="font-weight: 600;">${c.real_name || 'Unknown'}</span>
                                                ${cIdx === 0 ? '<span style="font-size: 0.7rem; background: var(--accent-dim); color: var(--accent); padding: 2px 6px; border-radius: 4px;">KEEP</span>' : ''}
                                            </div>
                                            <div style="font-size: 0.8rem; color: var(--text-muted); display: flex; flex-wrap: wrap; gap: 12px;">
                                                ${c.account_1 ? `<span>📱 @${c.account_1}</span>` : '<span style="color: var(--danger);">📱 No TikTok</span>'}
                                                ${c.discord_name ? `<span>💬 ${c.discord_name}</span>` : '<span style="color: var(--warning);">💬 No Discord</span>'}
                                                ${c.email ? `<span>📧 ${c.email}</span>` : ''}
                                                <span>Role: ${c.role || '−'}</span>
                                            </div>
                                        </div>
                                        <div style="display: flex; gap: 6px;">
                                            ${cIdx > 0 ? `
                                                <button class="btn btn-secondary" onclick="mergeDuplicates(${d.creators[0].id}, ${c.id})" 
                                                        style="font-size: 0.75rem; padding: 4px 10px;" title="Merge into first entry">
                                                    ⤴️ Merge
                                                </button>
                                                <button class="btn btn-secondary" onclick="deleteDuplicateEntry(${c.id}, '${(c.real_name || c.account_1 || '').replace(/'/g, "\\'")}')" 
                                                        style="font-size: 0.75rem; padding: 4px 10px; color: var(--danger);" title="Delete this entry">
                                                    🗑️
                                                </button>
                                            ` : `
                                                <button class="btn btn-secondary" onclick="editCreator(${c.id})" 
                                                        style="font-size: 0.75rem; padding: 4px 10px;">
                                                    ✏️ Edit
                                                </button>
                                            `}
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `).join('')}
                `;
            }
        }

        function filterSmartMatchResults() {
            renderSmartMatchResults();
        }

        function toggleOrphanSelection(normalized, brand, creatorName) {
            const key = 'orphan-' + normalized + '-' + brand;
            if (smartMatchData.selectedMatches.has(key)) {
                smartMatchData.selectedMatches.delete(key);
            } else {
                smartMatchData.selectedMatches.set(key, {
                    type: 'orphan',
                    data: { normalized, brand, creator_name: creatorName }
                });
            }
            updateSmartMatchSelectedCount();
            renderSmartMatchResults();
        }

        function updateSmartMatchSelectedCount() {
            const count = smartMatchData.selectedMatches.size;
            document.getElementById('smartMatchSelectedCount').textContent = count + ' selected';
            document.getElementById('applyMatchesBtn').disabled = count === 0;
        }

        async function linkTikTokToCreator(creatorId, tiktokHandle) {
            if (!confirm(`Link @${tiktokHandle} to this creator?`)) return;
            
            const { error } = await supabaseClient.from('managed_creators')
                .update({ account_1: tiktokHandle.toLowerCase() })
                .eq('id', creatorId);
            
            if (error) {
                showToast('Error linking: ' + error.message, 'error');
                return;
            }
            
            showToast(`Linked @${tiktokHandle}!`, 'success');
            await loadManagedCreators();
            runSmartMatch();
        }

        async function useHandleAsName(creatorId, handle) {
            const { error } = await supabaseClient.from('managed_creators')
                .update({ real_name: handle })
                .eq('id', creatorId);
            
            if (error) {
                showToast('Error: ' + error.message, 'error');
                return;
            }
            
            showToast('Name updated!', 'success');
            await loadManagedCreators();
            runSmartMatch();
        }

        async function mergeDuplicates(keepId, mergeId) {
            // Get both records
            const keepRecord = managedCreators.find(c => c.id === keepId);
            const mergeRecord = managedCreators.find(c => c.id === mergeId);
            
            if (!keepRecord || !mergeRecord) {
                showToast('Could not find records to merge', 'error');
                return;
            }

            // Build merged data - fill in blanks from mergeRecord
            const mergedData = {};
            
            // Fill missing fields from merge record
            if (!keepRecord.real_name && mergeRecord.real_name) mergedData.real_name = mergeRecord.real_name;
            if (!keepRecord.discord_name && mergeRecord.discord_name) mergedData.discord_name = mergeRecord.discord_name;
            if (!keepRecord.discord_id && mergeRecord.discord_id) mergedData.discord_id = mergeRecord.discord_id;
            if (!keepRecord.email && mergeRecord.email) mergedData.email = mergeRecord.email;
            if (!keepRecord.account_1 && mergeRecord.account_1) mergedData.account_1 = mergeRecord.account_1;
            if (!keepRecord.account_2 && mergeRecord.account_2) mergedData.account_2 = mergeRecord.account_2;
            if (!keepRecord.account_3 && mergeRecord.account_3) mergedData.account_3 = mergeRecord.account_3;
            if (!keepRecord.notes && mergeRecord.notes) {
                mergedData.notes = mergeRecord.notes;
            } else if (keepRecord.notes && mergeRecord.notes && keepRecord.notes !== mergeRecord.notes) {
                mergedData.notes = keepRecord.notes + '\n---\n' + mergeRecord.notes;
            }
            
            // If merge record has a higher retainer, keep it
            if ((mergeRecord.retainer || 0) > (keepRecord.retainer || 0)) {
                mergedData.retainer = mergeRecord.retainer;
            }

            const hasUpdates = Object.keys(mergedData).length > 0;
            
            // Show confirmation
            const confirmMsg = hasUpdates 
                ? `Merge will:\n• Update ${Object.keys(mergedData).length} field(s) in "${keepRecord.real_name || keepRecord.account_1 || 'Unknown'}"\n• Delete "${mergeRecord.real_name || mergeRecord.account_1 || 'Unknown'}"\n\nContinue?`
                : `No new data to merge. Delete "${mergeRecord.real_name || mergeRecord.account_1 || 'Unknown'}"?`;
            
            if (!confirm(confirmMsg)) return;

            // Update keep record if there are changes
            if (hasUpdates) {
                const { error: updateError } = await supabaseClient.from('managed_creators')
                    .update(mergedData)
                    .eq('id', keepId);
                
                if (updateError) {
                    showToast('Error updating record: ' + updateError.message, 'error');
                    return;
                }
            }

            // Delete merge record
            const { error: deleteError } = await supabaseClient.from('managed_creators')
                .delete()
                .eq('id', mergeId);
            
            if (deleteError) {
                showToast('Error deleting duplicate: ' + deleteError.message, 'error');
                return;
            }

            showToast('Merged successfully!', 'success');
            await loadManagedCreators();
            runSmartMatch();
            loadRosterData();
        }

        async function deleteDuplicateEntry(id, name) {
            if (!confirm(`Delete "${name}" from roster?\n\nThis cannot be undone.`)) return;
            
            const { error } = await supabaseClient.from('managed_creators')
                .delete()
                .eq('id', id);
            
            if (error) {
                showToast('Error: ' + error.message, 'error');
                return;
            }
            
            showToast('Entry deleted', 'success');
            await loadManagedCreators();
            runSmartMatch();
            loadRosterData();
        }

        async function applySmartMatches() {
            const matches = [...smartMatchData.selectedMatches.values()];
            if (matches.length === 0) return;
            
            const orphans = matches.filter(m => m.type === 'orphan');
            
            if (orphans.length > 0) {
                const records = orphans.map(m => ({
                    brand: m.data.brand,
                    role: 'Incubator',
                    account_1: m.data.normalized,
                    real_name: m.data.creator_name // Use TikTok handle as name initially
                }));
                
                const { error } = await supabaseClient.from('managed_creators').insert(records);
                
                if (error) {
                    showToast('Error adding creators: ' + error.message, 'error');
                    return;
                }
                
                showToast(`Added ${orphans.length} creators to roster!`, 'success');
            }
            
            smartMatchData.selectedMatches.clear();
            updateSmartMatchSelectedCount();
            await loadManagedCreators();
            loadRosterData();
            runSmartMatch();
        }

        function renderRosterInsights(rosterWithPerf) {
            // Top Performers - top 5 by GMV
            const topPerformers = rosterWithPerf.filter(c => c.gmv > 0).slice(0, 5);
            document.getElementById('rosterTopPerformers').innerHTML = topPerformers.length ? topPerformers.map((c, i) => `
                <div class="leaderboard-item" onclick="openCreatorDetail('${(c.account_1 || '').replace(/'/g, "\\'")}', '${c.brand}')" style="cursor: pointer;">
                    <div class="leaderboard-rank">${i + 1}</div>
                    <div class="leaderboard-info">
                        <div class="leaderboard-name">${c.real_name || c.account_1 || 'Unknown'}</div>
                        <div class="leaderboard-brand">${BRAND_DISPLAY[c.brand] || c.brand} • ${c.role || '−'}</div>
                    </div>
                    <div class="leaderboard-value">${fmtMoney(c.gmv)}</div>
                </div>
            `).join('') : '<div class="empty-state" style="padding: 20px;"><p>No performance data</p></div>';

            // Needs Attention - roster creators with declining or zero GMV
            const needsAttention = rosterWithPerf
                .filter(c => c.gmv === 0 || c.gmvChange < -20)
                .sort((a, b) => a.gmvChange - b.gmvChange)
                .slice(0, 5);
            
            document.getElementById('rosterNeedsAttention').innerHTML = needsAttention.length ? needsAttention.map(c => {
                const reason = c.gmv === 0 ? 'No GMV' : `↓${Math.abs(c.gmvChange).toFixed(0)}%`;
                const reasonClass = c.gmv === 0 ? 'color: var(--warning)' : 'color: var(--danger)';
                return `
                <div class="leaderboard-item" onclick="openCreatorDetail('${(c.account_1 || '').replace(/'/g, "\\'")}', '${c.brand}')" style="cursor: pointer;">
                    <div class="leaderboard-info">
                        <div class="leaderboard-name">${c.real_name || c.account_1 || 'Unknown'}</div>
                        <div class="leaderboard-brand">${BRAND_DISPLAY[c.brand] || c.brand}</div>
                    </div>
                    <div class="leaderboard-value" style="${reasonClass}">${reason}</div>
                </div>
            `}).join('') : '<div class="empty-state" style="padding: 20px;"><p>All creators performing well! 🎉</p></div>';

            // Follow-ups Due - creators with upcoming or overdue follow-ups
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayStr = today.toISOString().split('T')[0];
            
            const followupsDue = rosterWithPerf
                .filter(c => c.next_followup_date)
                .map(c => {
                    const followupDate = new Date(c.next_followup_date + 'T00:00:00');
                    const diffDays = Math.floor((followupDate - today) / (1000 * 60 * 60 * 24));
                    return { ...c, diffDays, followupDate };
                })
                .filter(c => c.diffDays <= 3) // Due within 3 days or overdue
                .sort((a, b) => a.diffDays - b.diffDays)
                .slice(0, 5);

            document.getElementById('rosterFollowups').innerHTML = followupsDue.length ? followupsDue.map(c => {
                let urgency = '';
                let urgencyStyle = '';
                if (c.diffDays < 0) {
                    urgency = `Overdue ${Math.abs(c.diffDays)}d`;
                    urgencyStyle = 'color: var(--danger); font-weight: 600;';
                } else if (c.diffDays === 0) {
                    urgency = 'Today';
                    urgencyStyle = 'color: var(--warning); font-weight: 600;';
                } else if (c.diffDays === 1) {
                    urgency = 'Tomorrow';
                    urgencyStyle = 'color: var(--warning);';
                } else {
                    urgency = `In ${c.diffDays}d`;
                    urgencyStyle = 'color: var(--text-muted);';
                }
                return `
                <div class="leaderboard-item" onclick="editCreator(${c.id})" style="cursor: pointer;">
                    <div class="leaderboard-info">
                        <div class="leaderboard-name">${c.real_name || c.account_1 || 'Unknown'}</div>
                        <div class="leaderboard-brand">${BRAND_DISPLAY[c.brand] || c.brand}</div>
                    </div>
                    <div class="leaderboard-value" style="${urgencyStyle}">${urgency}</div>
                </div>
            `}).join('') : '<div class="empty-state" style="padding: 20px;"><p>No follow-ups scheduled</p></div>';
        }

        // Log contact quick action
        async function logContact(creatorId) {
            const today = new Date().toISOString().split('T')[0];
            
            // Prompt for next follow-up
            const nextFollowup = prompt('Next follow-up date (YYYY-MM-DD) or leave blank:');
            
            const updateData = { last_contact_date: today };
            if (nextFollowup && /^\d{4}-\d{2}-\d{2}$/.test(nextFollowup)) {
                updateData.next_followup_date = nextFollowup;
            }
            
            const { error } = await supabaseClient
                .from('managed_creators')
                .update(updateData)
                .eq('id', creatorId);
            
            if (error) {
                showToast('Error logging contact: ' + error.message, 'error');
                return;
            }
            
            showToast('Contact logged!', 'success');
            await loadManagedCreators();
            loadRosterData();
        }

        // Show all brand entries for a multi-brand creator
        function showAllBrands(creatorIdentifier) {
            const identifier = creatorIdentifier.toLowerCase();
            
            // Find all roster entries that match this creator
            const entries = managedCreators.filter(c => 
                c.real_name?.toLowerCase() === identifier ||
                c.discord_name?.toLowerCase() === identifier ||
                c.account_1?.toLowerCase() === identifier ||
                c.account_2?.toLowerCase() === identifier ||
                c.account_3?.toLowerCase() === identifier ||
                c.email?.toLowerCase() === identifier
            );
            
            if (entries.length === 0) {
                showToast('No entries found', 'error');
                return;
            }

            // Build modal content
            const content = `
                <div style="padding: 20px;">
                    <h3 style="margin-bottom: 16px; color: var(--text-primary);">
                        ${entries[0].real_name || entries[0].discord_name || entries[0].account_1} - All Brands
                    </h3>
                    <div style="display: grid; gap: 12px;">
                        ${entries.map(c => `
                            <div style="padding: 16px; background: var(--bg-secondary); border-radius: 10px; display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                                        <span class="badge-brand">${BRAND_DISPLAY[c.brand] || c.brand}</span>
                                        <span class="badge" style="background: var(--bg-card); color: var(--text-secondary);">${c.role || '−'}</span>
                                    </div>
                                    <div style="font-size: 0.85rem; color: var(--text-muted);">
                                        ${c.retainer ? `Retainer: ${fmtMoney(c.retainer)}/mo` : 'No retainer'}
                                        ${c.account_1 ? ` • @${c.account_1}` : ''}
                                    </div>
                                </div>
                                <div style="display: flex; gap: 8px;">
                                    <button class="btn btn-secondary" style="padding: 6px 12px; font-size: 0.8rem;" onclick="editCreator(${c.id}); closeAllBrandsModal();">Edit</button>
                                    <button class="btn btn-primary" style="padding: 6px 12px; font-size: 0.8rem;" onclick="openCreatorDetail('${(c.account_1 || '').replace(/'/g, "\\'")}', '${c.brand}'); closeAllBrandsModal();">View Stats</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
                        <div style="font-size: 0.85rem; color: var(--text-muted);">
                            Total Retainers: <strong style="color: var(--accent);">${fmtMoney(entries.reduce((s, c) => s + (c.retainer || 0), 0))}/mo</strong>
                        </div>
                        <button class="btn btn-secondary" onclick="closeAllBrandsModal()">Close</button>
                    </div>
                </div>
            `;

            // Show in a modal
            let modal = document.getElementById('allBrandsModal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'allBrandsModal';
                modal.className = 'modal-overlay';
                modal.innerHTML = `<div class="modal" style="max-width: 600px;"></div>`;
                document.body.appendChild(modal);
            }
            modal.querySelector('.modal').innerHTML = content;
            modal.classList.add('show');
        }

        function closeAllBrandsModal() {
            const modal = document.getElementById('allBrandsModal');
            if (modal) modal.classList.remove('show');
        }

        async function loadApplicationsSummary() {
            try {
                // Count pending applications
                const { data: pending, error: pendingError } = await supabaseClient
                    .from('creator_applications')
                    .select('id, brand', { count: 'exact' })
                    .eq('status', 'pending');

                const pendingCount = pending?.length || 0;

                // Count recent (last 7 days) approved
                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                const { data: recentApproved } = await supabaseClient
                    .from('creator_applications')
                    .select('id')
                    .eq('status', 'approved')
                    .gte('updated_at', sevenDaysAgo.toISOString());

                const recentApprovedCount = recentApproved?.length || 0;

                // Group pending by brand
                const pendingByBrand = {};
                (pending || []).forEach(app => {
                    pendingByBrand[app.brand] = (pendingByBrand[app.brand] || 0) + 1;
                });

                document.getElementById('rosterApplications').innerHTML = `
                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: ${pendingCount > 0 ? 'var(--warning-dim)' : 'var(--bg-secondary)'}; border-radius: 8px;">
                            <div>
                                <div style="font-size: 1.5rem; font-weight: 600; color: ${pendingCount > 0 ? 'var(--warning)' : 'var(--text-primary)'};">${pendingCount}</div>
                                <div style="font-size: 0.8rem; color: var(--text-muted);">Pending Review</div>
                            </div>
                            ${pendingCount > 0 ? `<button class="btn btn-secondary" onclick="switchView('applications')" style="padding: 6px 12px; font-size: 0.8rem;">Review →</button>` : ''}
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: var(--bg-secondary); border-radius: 8px;">
                            <div>
                                <div style="font-size: 1.2rem; font-weight: 600; color: var(--success);">${recentApprovedCount}</div>
                                <div style="font-size: 0.8rem; color: var(--text-muted);">Approved (7 days)</div>
                            </div>
                        </div>
                        ${Object.keys(pendingByBrand).length > 0 ? `
                            <div style="font-size: 0.75rem; color: var(--text-muted); border-top: 1px solid var(--border); padding-top: 8px;">
                                ${Object.entries(pendingByBrand).map(([b, count]) => `${BRAND_DISPLAY[b] || b}: ${count}`).join(' • ')}
                            </div>
                        ` : ''}
                    </div>
                `;
            } catch (err) {
                document.getElementById('rosterApplications').innerHTML = `
                    <div class="empty-state" style="padding: 20px;">
                        <p>Applications not configured</p>
                        <a href="applications_schema.sql" style="color: var(--accent); font-size: 0.8rem;">Setup guide</a>
                    </div>
                `;
            }
        }

        function exportRoster() {
            if (!rosterCache.withPerformance.length) {
                showToast('No data to export', 'error');
                return;
            }
            
            const headers = ['Real Name', 'Discord', 'Email', 'Phone', 'Brand', 'Status', 'GMV', 'Prior GMV', 'Change %', 'Tier', 'Retainer', 'Last Contact', 'Next Follow-up', 'Account 1', 'Account 2', 'Account 3', 'Account 4', 'Account 5', 'Notes'];
            const rows = rosterCache.withPerformance.map(c => [
                c.real_name || '',
                c.discord_name || '',
                c.email || '',
                c.phone || '',
                BRAND_DISPLAY[c.brand] || c.brand,
                c.status || 'Active',
                c.gmv.toFixed(2),
                c.priorGmv.toFixed(2),
                c.gmvChange.toFixed(1),
                c.tier.name,
                c.retainer || 0,
                c.last_contact_date || '',
                c.next_followup_date || '',
                c.account_1 || '',
                c.account_2 || '',
                c.account_3 || '',
                c.account_4 || '',
                c.account_5 || '',
                (c.notes || '').replace(/[\n\r]+/g, ' ')
            ]);
            
            const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `roster-export-${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            showToast(`Exported ${rosterCache.withPerformance.length} creators!`, 'success');
        }

        // Search debounce for roster
        let rosterSearchTimeout;
        document.getElementById('rosterSearchInput').addEventListener('input', () => {
            clearTimeout(rosterSearchTimeout);
            rosterSearchTimeout = setTimeout(() => {
                pages.roster = 1;
                loadRosterData();
            }, 300);
        });

