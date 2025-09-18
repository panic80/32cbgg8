"""Lightweight PDF table extraction helper using pdfplumber."""

from __future__ import annotations

from typing import List, Dict, Any

import pdfplumber
from tabulate import tabulate

from app.core.logging import get_logger

logger = get_logger(__name__)


class PDFTableExtractor:
    """Utility to extract tables from a PDF into structured dictionaries."""

    @staticmethod
    def extract_tables(path: str) -> List[Dict[str, Any]]:
        """Return a list of tables with markdown/text representations.

        Args:
            path: File system path to the PDF.

        Returns:
            A list of dictionaries containing table metadata and content.
        """
        tables: List[Dict[str, Any]] = []

        try:
            with pdfplumber.open(path) as pdf:
                for page_number, page in enumerate(pdf.pages, start=1):
                    try:
                        raw_tables = page.extract_tables()
                    except Exception as exc:
                        logger.debug(
                            "pdfplumber failed to extract tables on page %s of %s: %s",
                            page_number,
                            path,
                            exc,
                        )
                        continue

                    for table in raw_tables or []:
                        if not table:
                            continue

                        headers = table[0]
                        data_rows = table[1:] if len(table) > 1 else []

                        # Determine whether the first row is really headers (heuristic)
                        if headers and all((cell or "").strip() for cell in headers):
                            markdown = tabulate(
                                data_rows,
                                headers=headers,
                                tablefmt="github",
                                missingval="",
                            ) if data_rows else tabulate(
                                [headers],
                                tablefmt="github",
                                missingval="",
                            )
                        else:
                            headers = []
                            markdown = tabulate(
                                table,
                                tablefmt="github",
                                missingval="",
                            )

                        tables.append(
                            {
                                "title": None,
                                "page_number": page_number,
                                "headers": headers,
                                "rows": data_rows,
                                "markdown": markdown,
                            }
                        )

        except Exception as exc:
            logger.warning("Failed to open PDF for table extraction %s: %s", path, exc)

        return tables

