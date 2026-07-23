import html

import httpx

from core.config import BREVO_API_KEY, BREVO_SENDER_ID

BREVO_API_URL = "https://api.brevo.com/v3"
_cached_sender_id: int | None = None


class EmailDeliveryError(RuntimeError):
    pass


def _headers() -> dict[str, str]:
    if not BREVO_API_KEY:
        raise EmailDeliveryError("BREVO_API_KEY is not configured")
    return {
        "accept": "application/json",
        "api-key": BREVO_API_KEY,
        "content-type": "application/json",
    }


async def _resolve_sender_id(client: httpx.AsyncClient) -> int:
    global _cached_sender_id

    if BREVO_SENDER_ID:
        try:
            return int(BREVO_SENDER_ID)
        except ValueError as exc:
            raise EmailDeliveryError("BREVO_SENDER_ID must be a number") from exc

    if _cached_sender_id is not None:
        return _cached_sender_id

    try:
        response = await client.get(f"{BREVO_API_URL}/senders", headers=_headers())
    except httpx.HTTPError as exc:
        raise EmailDeliveryError("Could not connect to Brevo") from exc
    if response.status_code != 200:
        raise EmailDeliveryError(f"Brevo sender lookup failed with status {response.status_code}")

    senders = response.json().get("senders", [])
    sender = next((item for item in senders if item.get("active")), None)
    if sender is None:
        raise EmailDeliveryError("Brevo has no active sender")

    _cached_sender_id = int(sender["id"])
    return _cached_sender_id


async def send_password_reset_email(
    *,
    email: str,
    full_name: str,
    reset_url: str,
    expires_minutes: int,
) -> None:
    safe_name = html.escape(full_name)
    safe_url = html.escape(reset_url, quote=True)
    subject = "FENOMEN School — құпиясөзді қалпына келтіру"
    html_content = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#172033">
      <h2 style="color:#005f7a">Құпиясөзді қалпына келтіру</h2>
      <p>Сәлем, {safe_name}!</p>
      <p>FENOMEN School аккаунтының құпиясөзін өзгерту үшін төмендегі батырманы басыңыз.</p>
      <p style="margin:28px 0">
        <a href="{safe_url}" style="background:#005f7a;color:#fff;text-decoration:none;
           padding:14px 22px;border-radius:8px;display:inline-block;font-weight:600">
          Жаңа құпиясөз орнату
        </a>
      </p>
      <p>Сілтеме {expires_minutes} минут бойы жарамды және тек бір рет қолданылады.</p>
      <p style="font-size:13px;color:#667085">
        Егер бұл сұрауды сіз жібермеген болсаңыз, хатты елемеңіз.
      </p>
    </div>
    """
    text_content = (
        f"Сәлем, {full_name}!\n\n"
        "FENOMEN School аккаунтының құпиясөзін өзгерту үшін сілтемеге өтіңіз:\n"
        f"{reset_url}\n\n"
        f"Сілтеме {expires_minutes} минут бойы жарамды және тек бір рет қолданылады.\n"
        "Егер бұл сұрауды сіз жібермеген болсаңыз, хатты елемеңіз."
    )

    async with httpx.AsyncClient(timeout=httpx.Timeout(10.0)) as client:
        sender_id = await _resolve_sender_id(client)
        payload = {
            "sender": {"id": sender_id},
            "to": [{"email": email, "name": full_name}],
            "subject": subject,
            "htmlContent": html_content,
            "textContent": text_content,
        }
        try:
            response = await client.post(
                f"{BREVO_API_URL}/smtp/email",
                headers=_headers(),
                json=payload,
            )
        except httpx.HTTPError as exc:
            raise EmailDeliveryError("Could not connect to Brevo") from exc
        if response.status_code != 201:
            raise EmailDeliveryError(f"Brevo email send failed with status {response.status_code}")
