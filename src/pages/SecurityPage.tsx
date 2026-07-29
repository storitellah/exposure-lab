/** Security overview page (full details in SECURITY.md). */
export default function SecurityPage() {
  return (
    <div className="content-page">
      <h1>Security</h1>
      <p>
        Tatu Exposure Lab is a static, client-side application with no server, no accounts and
        no data collection — which removes most attack surface by design.
      </p>
      <h2>How the app protects you</h2>
      <ul>
        <li>Served over HTTPS with a strict Content Security Policy: only same-origin scripts and styles run; framing and object embedding are blocked.</li>
        <li>The Permissions-Policy allows camera access for this site only, and disables microphone, geolocation, payment and USB entirely.</li>
        <li>Uploaded images are validated by file signature (not just extension), size-limited, and decoded safely; malformed files are rejected.</li>
        <li>All user text (names, reflections) is sanitised and rendered as plain text — never as HTML.</li>
        <li>Challenge links are validated against a strict allowlist with size limits; unknown values are rejected.</li>
        <li>No <code>eval</code>, no dynamic script generation, no third-party CDNs — every asset ships with the app.</li>
        <li>The service worker caches only same-origin, successful responses in a versioned cache and cleans up old versions.</li>
      </ul>
      <h2>Reporting a vulnerability</h2>
      <p>
        Please report security issues through the Support page or the repository's issue
        tracker with the label <code>security</code>. Include steps to reproduce. See the
        project's <code>SECURITY.md</code> for the full policy.
      </p>
    </div>
  );
}
