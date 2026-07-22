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

    // Call at the top of any page that requires a logged-in admin.
    async requireSession() {
        const session = await this.getSession();
        if (!session) {
            window.location.href = "index.html";
            return null;
        }
        return session;
    }
};

// ---- Login page wiring (only runs if the login form is present) ----
(function () {
    const form = document.getElementById("adminLoginForm");
    if (!form) return;

    // If already logged in, skip straight to the dashboard.
    AdminAuth.getSession().then((session) => {
        if (session) window.location.href = "dashboard.html";
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

        window.location.href = "dashboard.html";
    });
})();
