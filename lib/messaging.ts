export function digitsForWhatsApp(phone: string | null | undefined): string {
  const d = (phone || "").replace(/\D/g, "");
  return d.length === 10 ? "91" + d : d;
}

export function fillTemplate(text: string, name: string): string {
  return text.replace(/{name}/g, name);
}

export function appendWhatsAppExtras(body: string, imageUrl?: string | null, ctaLabel?: string | null, ctaUrl?: string | null): string {
  const extras = [imageUrl && `Image: ${imageUrl}`, ctaUrl && `${ctaLabel || "Learn more"}: ${ctaUrl}`].filter(Boolean);
  return extras.length ? `${body}\n\n${extras.join("\n")}` : body;
}

export function emailHtml(body: string, imageUrl?: string | null, ctaLabel?: string | null, ctaUrl?: string | null): string {
  const paragraphs = body
    .split(/\n\s*\n/)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br />")}</p>`)
    .join("");
  const image = imageUrl ? `<p><a href="${imageUrl}"><img src="${imageUrl}" alt="" style="max-width:100%;height:auto;border-radius:8px;" /></a></p>` : "";
  const cta = ctaUrl ? `<p><a href="${ctaUrl}" style="display:inline-block;padding:10px 16px;background:#f59e0b;color:#111827;text-decoration:none;border-radius:6px;font-weight:600;">${ctaLabel || "Learn more"}</a></p>` : "";
  return `${paragraphs}${image}${cta}`;
}

export function waLink(phone: string, message: string): string {
  return `https://wa.me/${digitsForWhatsApp(phone)}?text=${encodeURIComponent(message)}`;
}

export function mailtoLink(email: string, subject: string, body: string): string {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function formatINR(n: number | null | undefined): string {
  return "₹" + Number(n || 0).toLocaleString("en-IN");
}
