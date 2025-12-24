// ==================== UTILS ====================
        // ==================== LOADING INDICATORS ====================
        
        const loadingTimers = new Map();
        
        function showLoading(viewId, message = 'Loading...', delay = 300) {
            // For initial overview load, show immediately (no delay)
            const isInitialOverview = viewId === 'overview' && !window.overviewLoadedOnce;
            const actualDelay = isInitialOverview ? 0 : delay;
            
            // Only show loading indicator if it takes longer than delay ms
            const timer = setTimeout(() => {
                const overlay = document.getElementById(`${viewId}-loading`);
                if (overlay) {
                    const textEl = overlay.querySelector('.loading-text');
                    if (textEl) textEl.textContent = message;
                    overlay.classList.remove('hidden');
                }
            }, actualDelay);
            loadingTimers.set(viewId, timer);
        }
        
        function hideLoading(viewId) {
            // Clear the timer if loading finished quickly
            const timer = loadingTimers.get(viewId);
            if (timer) {
                clearTimeout(timer);
                loadingTimers.delete(viewId);
            }
            
            const overlay = document.getElementById(`${viewId}-loading`);
            if (overlay) {
                overlay.classList.add('hidden');
            }
        }
        
        function updateLoadingMessage(viewId, message, subtext = null) {
            const overlay = document.getElementById(`${viewId}-loading`);
            if (overlay) {
                const textEl = overlay.querySelector('.loading-text');
                const subtextEl = overlay.querySelector('.loading-subtext');
                if (textEl) textEl.textContent = message;
                if (subtextEl && subtext) subtextEl.textContent = subtext;
            }
        }

        // ==================== PERFORMANCE: CACHING & LAZY LOADING ====================
        
        // Enhanced cache for API responses with configurable TTL
        const cache = {
            data: new Map(),
            defaultTtl: 60000, // 1 minute default
            ttlConfig: {
                // Longer TTL for slow-changing data
                'managed_creators': 300000,  // 5 minutes
                'available_dates': 300000,   // 5 minutes
                'roster': 120000,            // 2 minutes
                'applications': 60000,       // 1 minute
                // Shorter TTL for fast-changing data
                'overview': 30000,           // 30 seconds
                'dailyops': 30000,           // 30 seconds
                'brands': 60000,             // 1 minute
            },
            set(key, value, customTtl) {
                const ttl = customTtl || this.ttlConfig[key] || this.defaultTtl;
                this.data.set(key, { value, timestamp: Date.now(), ttl });
                console.log(`Cache SET: ${key} (TTL: ${ttl/1000}s)`);
            },
            get(key) {
                const item = this.data.get(key);
                if (!item) return null;
                if (Date.now() - item.timestamp > item.ttl) {
                    this.data.delete(key);
                    console.log(`Cache EXPIRED: ${key}`);
                    return null;
                }
                console.log(`Cache HIT: ${key}`);
                return item.value;
            },
            invalidate(key) {
                if (key) {
                    this.data.delete(key);
                    console.log(`Cache INVALIDATED: ${key}`);
                } else {
                    this.data.clear();
                    console.log('Cache CLEARED');
                }
            },
            // Invalidate related caches when data changes
            invalidateGroup(group) {
                const groups = {
                    'creators': ['creators', 'overview', 'leaderboard', 'roster'],
                    'applications': ['applications', 'overview'],
                    'performance': ['overview', 'brands', 'dailyops', 'weeklyops', 'creators']
                };
                (groups[group] || []).forEach(k => this.data.delete(k));
            }
        };
        
        // Request deduplication - prevent duplicate simultaneous requests
        const pendingRequests = new Map();
        
        async function dedupedFetch(key, fetchFn) {
            // Check cache first
            const cached = cache.get(key);
            if (cached) return cached;
            
            // Check if request is already in flight
            if (pendingRequests.has(key)) {
                console.log(`Request DEDUPED: ${key}`);
                return pendingRequests.get(key);
            }
            
            // Make the request
            const promise = fetchFn().then(result => {
                cache.set(key, result);
                pendingRequests.delete(key);
                return result;
            }).catch(err => {
                pendingRequests.delete(key);
                throw err;
            });
            
            pendingRequests.set(key, promise);
            return promise;
        }
        
        // Debounce helper for filter inputs
        function debounce(fn, delay = 300) {
            let timer;
            return function(...args) {
                clearTimeout(timer);
                timer = setTimeout(() => fn.apply(this, args), delay);
            };
        }
        
        // Track which views have been loaded (for lazy loading)
        const viewsLoaded = new Set();
        
        // Lazy load helper - only loads if not already loaded or force refresh
        async function lazyLoadView(view, loadFn, forceRefresh = false) {
            if (!forceRefresh && viewsLoaded.has(view)) {
                console.log(`View already loaded: ${view}`);
                return;
            }
            await loadFn();
            viewsLoaded.add(view);
        }

        // Format helpers
        const fmt = (n) => n?.toLocaleString() || '0';
        const fmtMoney = (n) => '$' + (n || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
        
        // Format retainer display - shows "Affiliate" badge for $0 retainers
        const fmtRetainer = (amount, showMonthly = false) => {
            if (amount === 0) return '<span class="badge" style="background: var(--blue-dim); color: var(--blue); font-size: 0.7rem;">Affiliate</span>';
            if (!amount || amount === null) return '-';
            return `${fmtMoney(amount)}${showMonthly ? '/mo' : ''}`;
        };
        const fmtPct = (n) => (n >= 0 ? '+' : '') + n?.toFixed(1) + '%';
        
        // Format currency with 2 decimal places
        function formatCurrency(n) {
            if (n === null || n === undefined) return '--';
            return '$' + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
        
        // Sanitize string to prevent XSS
        function sanitize(str) {
            if (!str) return '';
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        }
        
        // Format brand key to display name
        function formatBrandName(brand) {
            return BRAND_DISPLAY[brand] || brand || 'Unknown';
        }
        
        // Trend indicator helper - updates element with trend arrow and percentage
        function updateTrendIndicator(elementId, current, prior) {
            const el = document.getElementById(elementId);
            if (!el) return;
            
            if (prior === 0 || prior === null || prior === undefined) {
                if (current > 0) {
                    el.textContent = '↑ New';
                    el.className = 'stat-change positive';
                } else {
                    el.textContent = '--';
                    el.className = 'stat-change neutral';
                }
                return;
            }
            
            const change = ((current - prior) / prior) * 100;
            const arrow = change > 0 ? '↑' : change < 0 ? '↓' : '→';
            const sign = change > 0 ? '+' : '';
            
            el.textContent = `${arrow} ${sign}${change.toFixed(1)}%`;
            
            if (change > 5) {
                el.className = 'stat-change positive';
            } else if (change < -5) {
                el.className = 'stat-change negative';
            } else {
                el.className = 'stat-change neutral';
            }
        }
        
        // Parse helpers (Supabase returns strings for numeric columns)
        const pFloat = (v) => parseFloat(v) || 0;
        const pInt = (v) => parseInt(v) || 0;
        
        // Normalize TikTok handles - strip @, lowercase, trim
        function normalizeTikTok(handle) {
            if (!handle) return null;
            return handle.toLowerCase().replace(/^@/, '').trim() || null;
        }
        
        // Normalize Discord handles - lowercase, trim
        function normalizeDiscord(handle) {
            if (!handle) return null;
            return handle.toLowerCase().trim() || null;
        }

        // Convert Date to local YYYY-MM-DD string (timezone-safe)
        function localDateStr(date) {
            const d = date instanceof Date ? date : new Date(date);
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }

        function formatDate(dateStr) {
            if (!dateStr || dateStr === 'undefined' || dateStr === 'null') {
                return 'No date selected';
            }
            try {
                const d = new Date(dateStr + 'T00:00:00');
                if (isNaN(d.getTime())) {
                    return 'Invalid date';
                }
                return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
            } catch (e) {
                return 'Invalid date';
            }
        }

        // Update last updated timestamp
        function updateLastUpdated() {
            const now = new Date();
            const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
            document.getElementById('lastUpdated').textContent = `Last updated: ${timeStr}`;
        }

        // Show loading state in a container (different from overlay loading)
        function showContainerLoading(containerId) {
            const el = document.getElementById(containerId);
            if (el) {
                el.innerHTML = '<div class="loading"><div class="spinner"></div> Loading...</div>';
            }
        }

        // Show error state in a container
        function showError(containerId, message = 'Failed to load data') {
            const el = document.getElementById(containerId);
            if (el) {
                el.innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><h3>Error</h3><p>${message}</p><button class="btn btn-secondary" onclick="location.reload()">Retry</button></div>`;
            }
        }

        // Populate brand dropdowns dynamically
        function populateBrandDropdowns() {
            const brandSelects = document.querySelectorAll('select[id$="BrandFilter"], select[id="creatorBrand"]');
            brandSelects.forEach(select => {
                // Keep existing options if it's a filter (has "All" option)
                const isFilter = select.querySelector('option[value="all"]');
                select.innerHTML = '';
                if (isFilter) {
                    select.innerHTML = '<option value="all">All Brands</option>';
                }
                BRAND_OPTIONS.forEach(brand => {
                    const opt = document.createElement('option');
                    opt.value = brand.value;
                    opt.textContent = brand.label;
                    select.appendChild(opt);
                });
            });
        }

        // Mobile menu toggle
        function toggleMobileMenu() {
            const sidebar = document.querySelector('.sidebar');
            const overlay = document.querySelector('.mobile-overlay');
            sidebar.classList.toggle('open');
            overlay.classList.toggle('open');
        }

        // Close mobile menu when nav item clicked
        function closeMobileMenu() {
            const sidebar = document.querySelector('.sidebar');
            const overlay = document.querySelector('.mobile-overlay');
            sidebar.classList.remove('open');
            overlay.classList.remove('open');
        }

        // Close mobile menu on window resize to desktop
        window.addEventListener('resize', () => {
            if (window.innerWidth > 900) {
                closeMobileMenu();
            }
        });

        // ==================== ROLE-BASED ACCESS CONTROL ====================
        const ROLE_ACCESS = {
            'admin': ['opscenter', 'dailyops', 'weeklyops', 'overview', 'brands', 'creators', 'videos', 'products', 'roster', 'applications', 'payments', 'commissions', 'calculator', 'funnels', 'users', 'brandportal', 'creatorportal', 'settings', 'goals', 'activity', 'datastatus'],
            'content_lead': ['opscenter', 'dailyops', 'weeklyops', 'overview', 'brands', 'creators', 'videos', 'products', 'roster', 'applications'],
            'analyst': ['overview', 'brands', 'creators', 'videos', 'products', 'roster'],
            'payments': ['roster', 'payments', 'commissions'],
            'automations': ['roster', 'settings'],
            'va': ['datastatus']
        };
        
        function canAccessView(viewName) {
            const role = window.currentUserRole || 'admin';
            const allowedViews = ROLE_ACCESS[role] || ROLE_ACCESS['admin'];
            return allowedViews.includes(viewName);
        }
        
        function applyRoleBasedNav(role) {
            const allowedViews = ROLE_ACCESS[role] || [];
            
            // Hide nav items user can't access
            document.querySelectorAll('.nav-item[data-view]').forEach(item => {
                const view = item.getAttribute('data-view');
                if (!allowedViews.includes(view)) {
                    item.style.display = 'none';
                }
            });
            
            // Hide entire nav groups if all items are hidden
            document.querySelectorAll('.nav-group').forEach(group => {
                const visibleItems = group.querySelectorAll('.nav-item[data-view]:not([style*="display: none"])');
                if (visibleItems.length === 0) {
                    group.style.display = 'none';
                }
            });
            
            // Set default view based on role
            const defaultViews = {
                'admin': 'opscenter',
                'content_lead': 'opscenter',
                'analyst': 'overview',
                'payments': 'payments',
                'automations': 'roster',
                'va': 'datastatus'
            };
            
            const defaultView = defaultViews[role] || allowedViews[0] || 'overview';
            setTimeout(() => {
                const navItem = document.querySelector(`.nav-item[data-view="${defaultView}"]`);
                if (navItem) navItem.click();
            }, 100);
        }

