"""
Template Service - Jinja2 template rendering with custom filters
"""

from datetime import datetime
from typing import Any
from jinja2 import Environment, BaseLoader, select_autoescape


class TemplateService:
    """Service for rendering Jinja2 templates with custom filters"""

    def __init__(self):
        self.env = Environment(
            loader=BaseLoader(),
            autoescape=select_autoescape(['html', 'xml']),
            trim_blocks=True,
            lstrip_blocks=True
        )
        self._register_filters()

    def _register_filters(self):
        """Register custom Jinja2 filters"""
        self.env.filters['currency'] = self._filter_currency
        self.env.filters['format_date'] = self._filter_format_date
        self.env.filters['format_time'] = self._filter_format_time
        self.env.filters['title_case'] = self._filter_title_case
        self.env.filters['first_name'] = self._filter_first_name
        self.env.filters['last_name'] = self._filter_last_name
        self.env.filters['initials'] = self._filter_initials

    @staticmethod
    def _filter_currency(value: Any, symbol: str = '$', decimals: int = 2) -> str:
        """Format a number as currency"""
        try:
            num = float(value)
            return f"{symbol}{num:,.{decimals}f}"
        except (ValueError, TypeError):
            return str(value)

    @staticmethod
    def _filter_format_date(value: Any, format_str: str = '%B %d, %Y') -> str:
        """Format a date string or datetime object"""
        if isinstance(value, str):
            try:
                value = datetime.fromisoformat(value)
            except ValueError:
                return value
        if isinstance(value, datetime):
            return value.strftime(format_str)
        return str(value)

    @staticmethod
    def _filter_format_time(value: Any, format_str: str = '%I:%M %p') -> str:
        """Format a time string or datetime object"""
        if isinstance(value, str):
            try:
                value = datetime.fromisoformat(value)
            except ValueError:
                return value
        if isinstance(value, datetime):
            return value.strftime(format_str)
        return str(value)

    @staticmethod
    def _filter_title_case(value: str) -> str:
        """Convert string to title case"""
        return str(value).title()

    @staticmethod
    def _filter_first_name(value: str) -> str:
        """Extract first name from full name"""
        parts = str(value).strip().split()
        return parts[0] if parts else ''

    @staticmethod
    def _filter_last_name(value: str) -> str:
        """Extract last name from full name"""
        parts = str(value).strip().split()
        return parts[-1] if len(parts) > 1 else ''

    @staticmethod
    def _filter_initials(value: str) -> str:
        """Get initials from a name"""
        parts = str(value).strip().split()
        return ''.join(p[0].upper() for p in parts if p)

    def render(self, template_string: str, data: dict) -> str:
        """
        Render a template string with the provided data

        Args:
            template_string: Jinja2 template string
            data: Dictionary of variables to inject

        Returns:
            Rendered string
        """
        # Add default variables
        context = {
            'now': datetime.now(),
            'today': datetime.now().date(),
            **data
        }

        template = self.env.from_string(template_string)
        return template.render(**context)

    def validate(self, template_string: str) -> tuple[bool, str]:
        """
        Validate a template string

        Args:
            template_string: Jinja2 template string

        Returns:
            Tuple of (is_valid, error_message)
        """
        try:
            self.env.from_string(template_string)
            return True, ""
        except Exception as e:
            return False, str(e)
