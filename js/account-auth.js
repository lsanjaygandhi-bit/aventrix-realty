/*
 * AVENTRIX REALTY — BUYER ACCOUNT: LOGIN / SIGN UP / PASSWORD RESET
 * ---------------------------------------------------------------------
 * Uses Supabase Auth (email + password, email confirmation required —
 * configured in the Supabase Dashboard, not here). This file only
 * handles account.html's own forms. Wishlist / Shortlist / Recently
 * Viewed sync is handled by js/aventrix-storage.js; the logged-in
 * dashboard by js/account-dashboard.js.
 */

(function () {
    const sb = window.supabaseClient;
    const tabsWrap = document.getElementById("acctTabs");
    if (!tabsWrap || !sb) return; // not on account.html, or Supabase failed to load

    const panels = {
        login: document.getElementById("acctLoginForm"),
        signup: document.getElementById("acctSignupForm"),
        forgot: document.getElementById("acctForgotForm"),
        reset: document.getElementById("acctResetForm")
    };
    const messageEl = document.getElementById("acctMessage");
    const signupSuccessEl = document.getElementById("acctSignupSuccess");
    const loggedInPanel = document.getElementById("acctLoggedInPanel");
    const loggedInEmailEl = document.getElementById("acctLoggedInEmail");
    const signOutBtn = document.getElementById("acctSignOutBtn");

    function showPanel(name) {
        Object.keys(panels).forEach((key) => { panels[key].hidden = key !== name; });
        signupSuccessEl.hidden = true;
        tabsWrap.hidden = (name === "forgot" || name === "reset");
        clearMessage();
    }

    function setActiveTab(name) {
        tabsWrap.querySelectorAll(".acct-tab").forEach((btn) => {
            btn.classList.toggle("active", btn.getAttribute("data-tab") === name);
        });
    }

    function showMessage(text, type) {
        messageEl.textContent = text;
        messageEl.className = "acct-message acct-message-" + (type || "error");
        messageEl.hidden = false;
    }

    function clearMessage() {
        messageEl.hidden = true;
        messageEl.textContent = "";
    }

    function setLoading(form, isLoading) {
        const btn = form.querySelector(".acct-submit-btn");
        if (!btn) return;
        btn.disabled = isLoading;
        btn.dataset.originalText = btn.dataset.originalText || btn.textContent;
        btn.textContent = isLoading ? "Please wait…" : btn.dataset.originalText;
    }

    // ---------------------------------------------------------
    // TAB SWITCHING (Log In / Create Account)
    // ---------------------------------------------------------
    tabsWrap.querySelectorAll(".acct-tab").forEach((btn) => {
        btn.addEventListener("click", () => {
            const tab = btn.getAttribute("data-tab");
            setActiveTab(tab);
            showPanel(tab);
        });
    });

    // ---------------------------------------------------------
    // LOG IN
    // ---------------------------------------------------------
    panels.login.addEventListener("submit", async (e) => {
        e.preventDefault();
        clearMessage();
        const email = document.getElementById("loginEmail").value.trim();
        const password = document.getElementById("loginPassword").value;

        setLoading(panels.login, true);
        const { error } = await sb.auth.signInWithPassword({ email, password });
        setLoading(panels.login, false);

        if (error) {
            showMessage(error.message || "Unable to log in. Please check your email and password.", "error");
            return;
        }

        // Logged in successfully. Wishlist/Shortlist/Recently Viewed
        // still run on localStorage at this stage — that migration is
        // a separate step, not part of this one.
        window.location.href = "index.html";
    });

    // ---------------------------------------------------------
    // CREATE ACCOUNT
    // ---------------------------------------------------------
    panels.signup.addEventListener("submit", async (e) => {
        e.preventDefault();
        clearMessage();
        const name = document.getElementById("signupName").value.trim();
        const email = document.getElementById("signupEmail").value.trim();
        const password = document.getElementById("signupPassword").value;
        const confirmPassword = document.getElementById("signupPasswordConfirm").value;

        if (password !== confirmPassword) {
            showMessage("Passwords do not match.", "error");
            return;
        }
        if (password.length < 6) {
            showMessage("Password must be at least 6 characters.", "error");
            return;
        }

        setLoading(panels.signup, true);
        const { error } = await sb.auth.signUp({
            email,
            password,
            options: {
                data: { full_name: name },
                emailRedirectTo: window.location.origin + "/account.html"
            }
        });
        setLoading(panels.signup, false);

        if (error) {
            showMessage(error.message || "Unable to create your account. Please try again.", "error");
            return;
        }

        panels.signup.reset();
        panels.signup.hidden = true;
        tabsWrap.hidden = true;
        signupSuccessEl.hidden = false;
    });

    // ---------------------------------------------------------
    // FORGOT PASSWORD (send reset link)
    // ---------------------------------------------------------
    document.getElementById("acctForgotLink").addEventListener("click", () => {
        showPanel("forgot");
    });
    document.getElementById("acctBackToLoginLink").addEventListener("click", () => {
        setActiveTab("login");
        showPanel("login");
    });

    panels.forgot.addEventListener("submit", async (e) => {
        e.preventDefault();
        clearMessage();
        const email = document.getElementById("forgotEmail").value.trim();

        setLoading(panels.forgot, true);
        const { error } = await sb.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + "/account.html"
        });
        setLoading(panels.forgot, false);

        if (error) {
            showMessage(error.message || "Unable to send reset link. Please try again.", "error");
            return;
        }

        showMessage("If an account exists for that email, a reset link has been sent.", "success");
        panels.forgot.reset();
    });

    // ---------------------------------------------------------
    // RESET PASSWORD (only reachable via the emailed reset link,
    // which logs the browser into a temporary "recovery" session)
    // ---------------------------------------------------------
    // A password-reset link logs the browser into a temporary session;
    // that must show the Reset form, never the logged-in dashboard.
    let inRecovery = /type=recovery/.test(window.location.hash || "");
    window.AventrixAccountRecovery = () => inRecovery;

    sb.auth.onAuthStateChange((event) => {
        if (event === "PASSWORD_RECOVERY") {
            inRecovery = true;
            if (loggedInPanel) loggedInPanel.hidden = true;
            tabsWrap.hidden = true;
            showPanel("reset");
        }
    });

    panels.reset.addEventListener("submit", async (e) => {
        e.preventDefault();
        clearMessage();
        const password = document.getElementById("resetPassword").value;
        const confirmPassword = document.getElementById("resetPasswordConfirm").value;

        if (password !== confirmPassword) {
            showMessage("Passwords do not match.", "error");
            return;
        }
        if (password.length < 6) {
            showMessage("Password must be at least 6 characters.", "error");
            return;
        }

        setLoading(panels.reset, true);
        const { error } = await sb.auth.updateUser({ password });
        setLoading(panels.reset, false);

        if (error) {
            showMessage(error.message || "Unable to reset your password. Please try again.", "error");
            return;
        }

        showMessage("Your password has been reset. Redirecting…", "success");
        setTimeout(() => { window.location.href = "index.html"; }, 1800);
    });

    // Default view on load: Log In tab.
    showPanel("login");

    // ---------------------------------------------------------
    // ALREADY LOGGED IN — there's no full customer dashboard yet,
    // so this is a minimal check just to connect the header's new
    // account icon to something sensible: if a session already
    // exists, show a simple panel instead of the login form.
    // ---------------------------------------------------------
    if (signOutBtn) {
        signOutBtn.addEventListener("click", async () => {
            await sb.auth.signOut();
            window.location.reload();
        });
    }

    sb.auth.getSession().then(({ data }) => {
        const user = data && data.session && data.session.user;
        if (!user || !loggedInPanel || inRecovery) return;
        tabsWrap.hidden = true;
        Object.values(panels).forEach((p) => { p.hidden = true; });
        signupSuccessEl.hidden = true;
        clearMessage();
        if (loggedInEmailEl) loggedInEmailEl.textContent = user.email || "";
        loggedInPanel.hidden = false;
    });
})();
