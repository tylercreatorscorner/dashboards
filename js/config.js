        // Supabase config
        const SUPABASE_URL = 'https://elrsgxlyejlkzjcnhmak.supabase.co';
        const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVscnNneGx5ZWpsa3pqY25obWFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwMTQ5OTUsImV4cCI6MjA3OTU5MDk5NX0.8XScMdGkFRqRIDMPY3gWS5tk0Z8NbGzDXuH1dsnBdZ0';
        const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

        // ==================== PAGINATION CONFIG ====================
        const QUERY_PAGE_SIZE = 30000; // Matches Supabase query limit setting
        const MAX_PAGES = 10; // 10 pages × 30k = 300k rows max
        
        // Track if any query hit the pagination limit
        let dataLimitWarnings = new Set();
        
        // Helper function for paginated queries with limit detection
        async function fetchPaginated(tableName, selectFields, filters = {}, context = '') {
            let allData = [];
            let page = 0;
            let hasMore = true;
            
            while (hasMore) {
                let query = supabaseClient.from(tableName)
                    .select(selectFields)
                    .range(page * QUERY_PAGE_SIZE, (page + 1) * QUERY_PAGE_SIZE - 1);
                
                // Apply filters
                if (filters.gte) {
                    for (const [field, value] of Object.entries(filters.gte)) {
                        query = query.gte(field, value);
                    }
                }
                if (filters.lte) {
                    for (const [field, value] of Object.entries(filters.lte)) {
                        query = query.lte(field, value);
                    }
                }
                if (filters.eq) {
                    for (const [field, value] of Object.entries(filters.eq)) {
                        query = query.eq(field, value);
                    }
                }
                
                const { data, error } = await query;
                if (error || !data || data.length === 0) {
                    hasMore = false;
                } else {
                    allData = allData.concat(data);
                    hasMore = data.length === QUERY_PAGE_SIZE;
                    page++;
                }
                
                if (page >= MAX_PAGES) {
                    // Hit the limit - show warning
                    const warningKey = `${context || tableName}`;
                    if (!dataLimitWarnings.has(warningKey)) {
                        dataLimitWarnings.add(warningKey);
                        console.warn(`⚠️ Data limit reached for ${warningKey}: ${allData.length.toLocaleString()} rows fetched. Some data may be missing.`);
                        showDataLimitWarning(warningKey, allData.length);
                    }
                    break;
                }
            }
            
            return allData;
        }
        
        // Show warning toast when data limit is hit
        function showDataLimitWarning(context, rowCount) {
            showToast(`⚠️ Data limit reached for ${context}: ${rowCount.toLocaleString()} rows. Some data may be incomplete.`, 'warning', 8000);
        }
        
        // Reset warnings (call when date range changes)
        function resetDataLimitWarnings() {
            dataLimitWarnings.clear();
        }

        // Constants
        const BRAND_DISPLAY = {
            'catakor': 'Cata-Kor',
            'jiyu': 'JiYu',
            'physicians_choice': 'Physicians Choice',
            'peach_slices': 'Peach Slices',
            'yerba_magic': 'Yerba Magic',
            'toplux': 'Toplux Nutrition'
        };

        // Brand colors for styling
        const BRAND_COLORS = {
            'catakor': '#e74c3c',
            'jiyu': '#9b59b6',
            'physicians_choice': '#3498db',
            'peach_slices': '#ff6b9d',
            'yerba_magic': '#2ecc71',
            'toplux': '#00b894'
        };

        // Centralized brand options - single source of truth
        const BRAND_OPTIONS = [
            { value: 'catakor', label: 'Cata-Kor' },
            { value: 'jiyu', label: 'JiYu' },
            { value: 'physicians_choice', label: 'Physicians Choice' },
            { value: 'peach_slices', label: 'Peach Slices' },
            { value: 'yerba_magic', label: 'Yerba Magic' },
            { value: 'toplux', label: 'Toplux Nutrition' }
        ];

        // Discord server IDs per brand
        const DISCORD_SERVERS = {
            'catakor': '1166776019655602236',
            'jiyu': '1339335585776533708',
            'physicians_choice': '1181985490363240499',
            'pc_fiber': '1440008662591733800',
            'peach_slices': '1431714262254092379',
            'yerba_magic': '1191766972208259173'
        };

        // Test Discord link from creator modal
        function testDiscordLink() {
            const channelId = document.getElementById('creatorDiscordChannelId').value.trim();
            const brand = document.getElementById('creatorBrand').value;
            
            if (!channelId) {
                showToast('Enter a Discord channel ID first', 'warning');
                return;
            }
            
            const serverId = DISCORD_SERVERS[brand];
            if (!serverId) {
                showToast('No Discord server configured for this brand', 'warning');
                return;
            }
            
            const url = `https://discord.com/channels/${serverId}/${channelId}`;
            window.open(url, '_blank');
        }

        // Open Discord chat in desktop app
        function openDiscordChat(brand, channelId) {
            if (!channelId) {
                showToast('No Discord channel linked for this creator', 'warning');
                return;
            }
            const serverId = DISCORD_SERVERS[brand];
            if (!serverId) {
                showToast('Discord server not configured for this brand', 'warning');
                return;
            }
            // Opens Discord desktop app directly
            window.location.href = `discord://discord.com/channels/${serverId}/${channelId}`;
        }

        // Look up channel ID from managed creators and open chat
        function openDiscordChatForCreator(creatorName, brand) {
            closeQuickActionMenu();
            const info = getManagedInfo(creatorName);
            if (!info) {
                showToast('Creator not found in roster', 'warning');
                return;
            }
            openDiscordChat(brand, info.discord_channel_id);
        }

        // Date presets for quick selection
        const DATE_PRESETS = [
            { label: 'Yesterday', getDates: () => { const d = new Date(); d.setDate(d.getDate()-1); const t = localDateStr(d); return { start: t, end: t }; }},
            { label: 'Last 7 Days', getDates: () => { const e = new Date(); e.setDate(e.getDate()-1); const s = new Date(); s.setDate(s.getDate()-7); return { start: localDateStr(s), end: localDateStr(e) }; }},
            { label: 'Last 14 Days', getDates: () => { const e = new Date(); e.setDate(e.getDate()-1); const s = new Date(); s.setDate(s.getDate()-14); return { start: localDateStr(s), end: localDateStr(e) }; }},
            { label: 'Last 30 Days', getDates: () => { const e = new Date(); e.setDate(e.getDate()-1); const s = new Date(); s.setDate(s.getDate()-30); return { start: localDateStr(s), end: localDateStr(e) }; }},
            { label: 'This Month', getDates: () => { const e = new Date(); e.setDate(e.getDate()-1); const s = new Date(e.getFullYear(), e.getMonth(), 1); return { start: localDateStr(s), end: localDateStr(e) }; }},
            { label: 'Last Month', getDates: () => { const n = new Date(); const e = new Date(n.getFullYear(), n.getMonth(), 0); const s = new Date(n.getFullYear(), n.getMonth()-1, 1); return { start: localDateStr(s), end: localDateStr(e) }; }}
        ];

        const TIERS = [
            { name: 'Ruby', min: 200000, class: 'tier-ruby' },
            { name: 'Diamond', min: 100000, class: 'tier-diamond' },
            { name: 'Platinum', min: 50000, class: 'tier-platinum' },
            { name: 'Gold', min: 20000, class: 'tier-gold' },
            { name: 'Silver', min: 5000, class: 'tier-silver' },
            { name: 'Bronze', min: 2000, class: 'tier-bronze' },
            { name: 'New', min: 0, class: 'tier-new' }
        ];

        function getTier(gmv) {
            for (const tier of TIERS) {
                if (gmv >= tier.min) return tier;
            }
            return TIERS[TIERS.length - 1];
        }

        // State
        let managedCreators = [];
        let availableDates = { daily: [] };
        let currentView = 'overview';

        const PAGE_SIZE = 50;
        let pages = { creators: 1, videos: 1, roster: 1, products: 1 };

