export function renderEmail(entry, ctx) {
  const programs = ctx.programs || {};
  const p = programs[entry.programId] || { name: 'your program', degree: '', sheetUrl: '' };
  const sheetBtn = `<a href="${p.sheetUrl}" style="display:inline-block;background:#005D83;color:#fff;font-weight:bold;font-size:15px;padding:13px 24px;border-radius:8px;text-decoration:none">View your degree sheet (PDF)</a>`;
  const arch = entry.worldId && ctx.archetypes ? ctx.archetypes[entry.worldId] : null;

  if (arch) {
    const subject = `You're ${arch.name} — your Central Piedmont IT match`;
    const html = `<div style="font-family:Arial,Roboto,sans-serif;color:#54565A;max-width:560px;margin:0 auto">
      <div style="background:linear-gradient(160deg,#54565A,#3c3d3f);color:#fff;border-radius:12px;padding:24px;text-align:center">
        <div style="font-size:12px;letter-spacing:.2em;opacity:.85">WHAT KIND OF IT HERO ARE YOU?</div>
        <div style="font-size:34px;font-weight:bold;margin:6px 0">${arch.name}</div>
        <div style="font-size:15px;opacity:.92;line-height:1.4">${arch.blurb}</div>
      </div>
      <h3 style="color:#005D83;text-transform:uppercase;letter-spacing:.06em;font-size:14px;margin:22px 0 4px">The program you picked</h3>
      <div style="font-size:22px;font-weight:bold;color:#1a1a1a">${p.name}</div>
      <div style="color:#7a7a72;font-size:14px;margin-bottom:10px">${p.degree} · Central Piedmont</div>
      ${sheetBtn}
      <hr style="border:0;border-top:2px solid #B4A269;margin:22px 0">
      <p style="font-size:15px;line-height:1.5"><strong>Ready for the next step?</strong><br>
        <a href="${ctx.infoSessionUrl}" style="color:#005D83;font-weight:bold">Sign up for an information session &rarr;</a><br>
        Questions? An advisor can help you map your path.</p>
      <p style="color:#B4A269;font-weight:bold;font-size:15px">Central Piedmont — Powering a stronger future.</p>
    </div>`;
    return { subject, html };
  }

  const subject = `Your Central Piedmont degree sheet — ${p.name}`;
  const html = `<div style="font-family:Arial,Roboto,sans-serif;color:#54565A">
    <h2 style="color:#005D83">Thanks for stopping by!</h2>
    <p>Here's the degree information sheet for <strong>${p.name}</strong>:</p>
    <p>${sheetBtn}</p>
    <p>Questions? An advisor can help you map your next step.</p>
    <p style="color:#B4A269;font-weight:bold">Central Piedmont — Powering a stronger future.</p>
  </div>`;
  return { subject, html };
}

// transport: { send: async ({to,subject,html}) => void }. ctx: { programs, archetypes, infoSessionUrl }. Returns count sent.
export async function drainOutbox(outbox, transport, ctx) {
  let sent = 0;
  for (const entry of outbox.pending()) {
    const { subject, html } = renderEmail(entry, ctx);
    try {
      await transport.send({ to: entry.email, subject, html });
      outbox.markSent(entry.id);
      sent++;
    } catch {
      break;
    }
  }
  return sent;
}
