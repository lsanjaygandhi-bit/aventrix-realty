/*
 * AVENTRIX REALTY — ADMIN AUTH
 * -------------------------------
 * Handles the login form (index.html) and guards dashboard.html so it
 * can't be viewed without a valid Supabase Auth session.
 */

const AdminAuth = {
    async getSession() {
        const { data } = await window.supabaseClient.auth.getSession();
        return data.session;
    },

    async login(email, password) {
        return window.supabaseClient.auth.signInWithPassword({ email, password });
    },

    async logout() {
        await window.supabaseClient.auth.signOut();
        window.location.href = "index.html";
    },

    // Returns 'admin' | 'realtor' | 'customer' | 'anon' from the
    // database (public.app_role(), sql/migration-2026-09-25-01-…).
    // This is a convenience gate only — every permission is enforced
    // by Supabase RLS regardless of what this returns.
    async getRole() {
        const { data, error } = await window.supabaseClient.rpc("app_role");
        if (error) {
            console.error("Aventrix admin: role check failed", error);
            return null;
        }
        return data;
    },

    // Call at the top of any page that requires a logged-in admin or
    // realtor. Buyers (customers) who sign in on account.html share the
    // same Supabase Auth, so a session alone is NOT enough.
    async requireSession() {
        const session = await this.getSession();
        if (!session) {
            window.location.href = "index.html";
            return null;
        }
        const role = await this.getRole();
        if (role !== "admin" && role !== "realtor") {
            await window.supabaseClient.auth.signOut();
            window.location.href = "index.html?denied=1";
            return null;
        }
        session.appRole = role;
        window.AventrixAdminRole = role;
        return session;
    }
};

// ---- Login page wiring (only runs if the login form is present) ----
(function () {
    const form = document.getElementById("adminLoginForm");
    if (!form) return;

    const errorElInit = document.getElementById("adminLoginError");
    if (new URLSearchParams(window.location.search).get("denied") === "1") {
        errorElInit.textContent = "This account doesn't have Admin Panel access.";
        errorElInit.style.display = "block";
    }

    // If already logged in as staff, skip straight to the dashboard.
    AdminAuth.getSession().then(async (session) => {
        if (!session) return;
        const role = await AdminAuth.getRole();
        if (role === "admin" || role === "realtor") window.location.href = "dashboard.html";
    });

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const errorEl = document.getElementById("adminLoginError");
        const btn = form.querySelector("button[type=submit]");
        errorEl.style.display = "none";
        btn.disabled = true;
        btn.textContent = "Signing in...";

        const email = document.getElementById("adminEmail").value.trim();
        const password = document.getElementById("adminPassword").value;

        const { error } = await AdminAuth.login(email, password);

        if (error) {
            errorEl.textContent = "Incorrect email or password.";
            errorEl.style.display = "block";
            btn.disabled = false;
            btn.textContent = "Sign In";
            return;
        }

        const role = await AdminAuth.getRole();
        if (role !== "admin" && role !== "realtor") {
            await window.supabaseClient.auth.signOut();
            errorEl.textContent = role
                ? "This account doesn't have Admin Panel access."
                : "Couldn't verify access. Please make sure the latest database migration has been run.";
            errorEl.style.display = "block";
            btn.disabled = false;
            btn.textContent = "Sign In";
            return;
        }

        window.location.href = "dashboard.html";
    });
})();
