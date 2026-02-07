"""
Safety Service - Sensitive data detection
"""

import re
from typing import List, Dict, Any


class SafetyService:
    """Service for detecting sensitive data in text"""

    # Patterns for sensitive data detection
    PATTERNS = {
        'currency': [
            # USD amounts: $1,234.56 or $1234.56 or $1234
            r'\$[\d,]+(?:\.\d{2})?',
            # Currency with code: 1234.56 USD, 1234 EUR
            r'\d[\d,]*(?:\.\d{2})?\s*(?:USD|EUR|GBP|AED|SAR|INR|JPY|CNY)',
        ],
        'account_number': [
            # Bank account numbers (8-17 digits)
            r'\b\d{8,17}\b',
            # IBAN
            r'\b[A-Z]{2}\d{2}[A-Z0-9]{4,30}\b',
        ],
        'phone': [
            # International format
            r'\+\d{1,3}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}',
            # US format
            r'\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}',
        ],
        'email': [
            r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}',
        ],
        'ssn': [
            # US Social Security Number
            r'\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b',
        ],
        'credit_card': [
            # Credit card numbers (13-19 digits, possibly with spaces or dashes)
            r'\b(?:\d{4}[-.\s]?){3,4}\d{1,4}\b',
        ],
    }

    # Compile patterns for efficiency
    COMPILED_PATTERNS: Dict[str, List[re.Pattern]] = {}

    def __init__(self):
        # Compile all patterns on initialization
        for category, patterns in self.PATTERNS.items():
            self.COMPILED_PATTERNS[category] = [
                re.compile(pattern, re.IGNORECASE)
                for pattern in patterns
            ]

    def check_sensitive_data(self, text: str) -> Dict[str, Any]:
        """
        Check text for sensitive data patterns

        Args:
            text: Text to analyze

        Returns:
            Dictionary with:
                - hasSensitiveData: bool
                - findings: list of findings with type, value, and position
        """
        findings = []

        for category, patterns in self.COMPILED_PATTERNS.items():
            for pattern in patterns:
                for match in pattern.finditer(text):
                    # Avoid false positives for short number sequences
                    value = match.group()

                    # Skip if it looks like a year (1900-2100)
                    if category == 'account_number':
                        try:
                            num = int(value.replace(',', '').replace(' ', ''))
                            if 1900 <= num <= 2100:
                                continue
                        except ValueError:
                            pass

                    findings.append({
                        'type': category,
                        'value': value,
                        'position': {
                            'start': match.start(),
                            'end': match.end()
                        }
                    })

        # Deduplicate findings (same position)
        seen_positions = set()
        unique_findings = []
        for finding in findings:
            pos_key = (finding['position']['start'], finding['position']['end'])
            if pos_key not in seen_positions:
                seen_positions.add(pos_key)
                unique_findings.append(finding)

        return {
            'hasSensitiveData': len(unique_findings) > 0,
            'findings': unique_findings
        }

    def redact(self, text: str, replacement: str = '***') -> str:
        """
        Redact sensitive data from text

        Args:
            text: Text to redact
            replacement: String to replace sensitive data with

        Returns:
            Text with sensitive data redacted
        """
        result = text
        check = self.check_sensitive_data(text)

        # Sort findings by position (reverse order to not mess up positions)
        sorted_findings = sorted(
            check['findings'],
            key=lambda f: f['position']['start'],
            reverse=True
        )

        for finding in sorted_findings:
            start = finding['position']['start']
            end = finding['position']['end']
            result = result[:start] + replacement + result[end:]

        return result

    def highlight(self, text: str, start_tag: str = '<mark>', end_tag: str = '</mark>') -> str:
        """
        Highlight sensitive data in text with HTML tags

        Args:
            text: Text to highlight
            start_tag: HTML tag to start highlight
            end_tag: HTML tag to end highlight

        Returns:
            Text with sensitive data highlighted
        """
        result = text
        check = self.check_sensitive_data(text)

        # Sort findings by position (reverse order)
        sorted_findings = sorted(
            check['findings'],
            key=lambda f: f['position']['start'],
            reverse=True
        )

        for finding in sorted_findings:
            start = finding['position']['start']
            end = finding['position']['end']
            original = result[start:end]
            result = result[:start] + start_tag + original + end_tag + result[end:]

        return result
