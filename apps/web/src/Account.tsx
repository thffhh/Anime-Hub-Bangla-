  if (!user) {
    return (
      <div className="account-shell">
        <div className="account-glow account-glow-one" />
        <div className="account-glow account-glow-two" />

        <a className="account-brand" href="/">
          <span className="account-brand-icon">AH</span>
          <span>
            ANIME HUB <b>BANGLA</b>
            <small>YOUR ANIME UNIVERSE</small>
          </span>
        </a>

        <main className="account-auth-layout">
          <section className="account-intro">
            <div className="account-kicker">
              <span /> WELCOME TO ANIME HUB BANGLA
            </div>

            <h1>
              Every story.
              <br />
              <em>One universe.</em>
            </h1>

            <p>
              Sign in to continue your anime journey.
              Save your watch progress, build your
              personal watchlist and explore the
              Bangla anime community.
            </p>

            <div className="account-benefits">
              <div><span>01</span> Continue watching from where you left off</div>
              <div><span>02</span> Save your favourite anime</div>
              <div><span>03</span> Manage your membership</div>
            </div>
          </section>

          <form className="account-card" onSubmit={submit}>
            <div className="account-card-top">
              <span className="account-card-icon">✦</span>
              <span>MEMBER ACCESS</span>
            </div>

            <div className="account-eyebrow">
              {mode === 'login' ? 'GOOD TO SEE YOU AGAIN' : 'JOIN THE COMMUNITY'}
            </div>

            <h2>
              {mode === 'login' ? 'Welcome back' : 'Create your account'}
            </h2>

            <p className="account-description">
              {mode === 'login'
                ? 'Enter your details to access your account.'
                : 'Create your free Anime Hub Bangla account.'}
            </p>

            {mode === 'register' && (
              <label className="account-field">
                <span>Display name</span>
                <input
                  required
                  minLength={2}
                  maxLength={60}
                  placeholder="Your name"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  autoComplete="name"
                />
              </label>
            )}

            <label className="account-field">
              <span>Email address</span>
              <input
                required
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
              />
            </label>

            <label className="account-field">
              <span>Password</span>
              <input
                required
                minLength={mode === 'register' ? 8 : 1}
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </label>

            <button className="account-submit" type="submit">
              {mode === 'login' ? 'Sign in to your account' : 'Create free account'}
              <span>→</span>
            </button>

            {message && (
              <div
                className={`account-message ${
                  message === 'Please wait...' ? 'loading' : 'error'
                }`}
                role="status"
              >
                {message}
              </div>
            )}

            <div className="account-switch">
              {mode === 'login'
                ? "Don't have an account?"
                : 'Already have an account?'}
              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'login' ? 'register' : 'login');
                  setMessage('');
                }}
              >
                {mode === 'login' ? 'Create account' : 'Sign in'}
              </button>
            </div>

            <div className="account-divider"><span>ANIME HUB BANGLA</span></div>

            <a href="/" className="account-back">
              ← Back to homepage
            </a>
          </form>
        </main>

        <footer className="account-footer">
          <span>© {new Date().getFullYear()} Anime Hub Bangla</span>
          <span>MADE FOR ANIME LOVERS</span>
        </footer>
      </div>
    );
  }
