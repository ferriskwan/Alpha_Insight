"""RSS ingestion service for financial news and sector publications."""

from __future__ import annotations

import logging
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from typing import Any

logger = logging.getLogger(__name__)

# Default desktop browser user agent to avoid bot rejection
DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
)


def fetch_sector_rss_news(ticker: str, limit: int = 5, timeout_seconds: float = 5.0) -> list[dict[str, Any]]:
    """Fetch top news headlines, publication dates, and source links for a ticker/sector ETF.

    Queries Yahoo Finance RSS feed (s={ticker}&region=US&lang=en-US).
    Falls back gracefully to an empty list on network error, invalid XML, or timeout.
    """
    clean_ticker = (ticker or "").strip().upper()
    if not clean_ticker:
        return []

    url = f"https://feeds.finance.yahoo.com/rss/2.0/headline?s={urllib.parse.quote(clean_ticker)}&region=US&lang=en-US"
    req = urllib.request.Request(
        url,
        headers={"User-Agent": DEFAULT_USER_AGENT},
    )

    try:
        with urllib.request.urlopen(req, timeout=timeout_seconds) as response:
            xml_content = response.read()

        root = ET.fromstring(xml_content)
        items = root.findall(".//item")
        results: list[dict[str, Any]] = []

        for item in items[:limit]:
            title_node = item.find("title")
            link_node = item.find("link")
            pub_date_node = item.find("pubDate")
            source_node = item.find("source")

            title = title_node.text.strip() if title_node is not None and title_node.text else ""
            raw_link = link_node.text.strip() if link_node is not None and link_node.text else ""
            # Strip trailing query params like ?.tsrc=rss for cleaner URLs if present
            clean_url = raw_link.split("?.tsrc=rss")[0] if raw_link else ""
            published_at = pub_date_node.text.strip() if pub_date_node is not None and pub_date_node.text else ""
            publisher = source_node.text.strip() if source_node is not None and source_node.text else "Yahoo Finance"

            if title and (clean_url or raw_link):
                results.append(
                    {
                        "title": title,
                        "url": clean_url or raw_link,
                        "publisher": publisher,
                        "published_at": published_at,
                    }
                )

        return results
    except Exception as exc:
        logger.warning("Error fetching RSS news for %s: %s", clean_ticker, exc)
        return []
