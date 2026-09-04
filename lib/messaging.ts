export function digitsForWhatsApp(phone: string | null | undefined): string {
  const d = (phone || "").replace(/\D/g, "");
  return d.length === 10 ? "91" + d : d;
}

export function fillTemplate(text: string, name: string): string {
  return text.replace(/{name}/g, name);
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
