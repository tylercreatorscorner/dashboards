        // Stub functions to prevent errors while main script loads
        window.switchView = function(view) { 
            console.log('switchView called before ready, queueing:', view);
            window._pendingView = view;
        };
        window.applyRoleBasedNav = function() {};
        
        let authSupabase = null;
        let currentSession = null;
        
        // Auth check - wait for DOM to ensure all functions are defined
        document.addEventListener('DOMContentLoaded', async function() {
            const SUPABASE_URL = 'https://elrsgxlyejlkzjcnhmak.supabase.co';
            const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVscnNneGx5ZWpsa3pqY25obWFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwMTQ5OTUsImV4cCI6MjA3OTU5MDk5NX0.8XScMdGkFRqRIDMPY3gWS5tk0Z8NbGzDXuH1dsnBdZ0';

            try {
                authSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
                
                const { data: { session }, error: sessionError } = await authSupabase.auth.getSession();
                currentSession = session;
                
                console.log('Admin auth check - session:', session ? 'found' : 'not found');

                if (!session) {
                    window.location.href = 'index.html';
                    return;
                }

                // Check if user has team role in user_profiles
                const { data: profile, error: profileError } = await authSupabase
                    .from('user_profiles')
                    .select('role, status')
                    .eq('user_id', session.user.id)
                    .single();
                
                console.log('Profile check:', profile, profileError);

                // Define allowed team roles
                const teamRoles = ['admin', 'content_lead', 'analyst', 'payments', 'automations', 'va'];
                
                if (profile && teamRoles.includes(profile.role) && profile.status === 'approved') {
                    // User is authorized - show admin panel
                    window.currentUserRole = profile.role;
                    
                    if (typeof applyRoleBasedNav === 'function') {
                        applyRoleBasedNav(profile.role);
                    }

                    document.getElementById('authCheck').style.display = 'none';
                    
                    const name = session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Admin';
                    document.getElementById('adminAvatar').textContent = name.charAt(0).toUpperCase();
                    document.getElementById('adminName').textContent = name;
                    
                    const roleLabels = {
                        'admin': 'Administrator',
                        'content_lead': 'Content Lead',
                        'analyst': 'Analyst',
                        'payments': 'Payments',
                        'automations': 'Automations',
                        'va': 'VA'
                    };
                    document.getElementById('adminRole').textContent = roleLabels[profile.role] || profile.role;
                    return;
                }

                // Not authorized - check for existing access request
                const { data: existingRequest } = await authSupabase
                    .from('admin_access_requests')
                    .select('*')
                    .eq('user_id', session.user.id)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single();

                // Pre-fill name from Discord
                const userName = session.user.user_metadata?.name || session.user.user_metadata?.full_name || '';
                document.getElementById('requestName').value = userName;

                if (existingRequest) {
                    if (existingRequest.status === 'pending') {
                        // Show pending state
                        showAccessPending(existingRequest);
                    } else if (existingRequest.status === 'denied') {
                        // Show denied state
                        showAccessDenied(existingRequest.denied_reason);
                    }
                    // If approved, they should have a user_profile, so show request form as fallback
                } else {
                    // No request yet - show request form
                    showAccessRequestForm();
                }

            } catch (err) {
                console.error('Auth check failed:', err);
                // Show request form on error (table might not exist yet)
                showAccessRequestForm();
            }
        });

        function showAccessRequestForm() {
            document.getElementById('authCheck').style.display = 'none';
            document.getElementById('accessRequestScreen').style.display = 'block';
            document.getElementById('accessRequestForm').style.display = 'block';
            document.getElementById('accessPendingState').style.display = 'none';
            document.getElementById('accessDeniedState').style.display = 'none';
        }

        function showAccessPending(request) {
            document.getElementById('authCheck').style.display = 'none';
            document.getElementById('accessRequestScreen').style.display = 'block';
            document.getElementById('accessRequestForm').style.display = 'none';
            document.getElementById('accessPendingState').style.display = 'block';
            document.getElementById('accessDeniedState').style.display = 'none';
            
            const submitted = new Date(request.created_at).toLocaleString();
            document.getElementById('requestSubmittedAt').textContent = `Submitted: ${submitted}`;
        }

        function showAccessDenied(reason) {
            document.getElementById('authCheck').style.display = 'none';
            document.getElementById('accessRequestScreen').style.display = 'block';
            document.getElementById('accessRequestForm').style.display = 'none';
            document.getElementById('accessPendingState').style.display = 'none';
            document.getElementById('accessDeniedState').style.display = 'block';
            
            if (reason) {
                document.getElementById('deniedReason').textContent = reason;
            }
        }

        async function submitAccessRequest() {
            const name = document.getElementById('requestName').value.trim();
            const role = document.getElementById('requestRole').value;
            const reason = document.getElementById('requestReason').value.trim();

            if (!name) {
                alert('Please enter your name');
                return;
            }

            try {
                const { error } = await authSupabase.from('admin_access_requests').insert({
                    user_id: currentSession.user.id,
                    email: currentSession.user.email,
                    name: name,
                    requested_role: role,
                    reason: reason,
                    discord_id: currentSession.user.user_metadata?.provider_id || null,
                    discord_username: currentSession.user.user_metadata?.name || currentSession.user.user_metadata?.full_name || null,
                    discord_avatar: currentSession.user.user_metadata?.avatar_url || null,
                    status: 'pending'
                });

                if (error) throw error;

                showAccessPending({ created_at: new Date().toISOString() });
            } catch (err) {
                console.error('Failed to submit request:', err);
                alert('Failed to submit request. Please try again.');
            }
        }

        async function resetAccessRequest() {
            // Delete old denied request and show form again
            try {
                await authSupabase.from('admin_access_requests')
                    .delete()
                    .eq('user_id', currentSession.user.id)
                    .eq('status', 'denied');
            } catch (err) {
                console.error('Error resetting request:', err);
            }
            showAccessRequestForm();
        }

        async function accessLogout() {
            await authSupabase.auth.signOut();
            window.location.href = 'index.html';
        }

        // Admin logout function
        async function adminLogout() {
            const SUPABASE_URL = 'https://elrsgxlyejlkzjcnhmak.supabase.co';
            const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVscnNneGx5ZWpsa3pqY25obWFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwMTQ5OTUsImV4cCI6MjA3OTU5MDk5NX0.8XScMdGkFRqRIDMPY3gWS5tk0Z8NbGzDXuH1dsnBdZ0';
            const supabaseAuth = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
            await supabaseAuth.auth.signOut();
            window.location.href = 'index.html';
        }
