"""
DOCX Template Service - Parse, render, and convert DOCX templates to PDF
"""

import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any, Optional
from datetime import datetime


class DocxTemplateService:
    """Service for handling DOCX templates with Jinja2-style placeholders"""

    def __init__(self):
        self._check_dependencies()

    def _check_dependencies(self):
        """Check that required dependencies are available"""
        try:
            import docxtpl
        except ImportError:
            raise ImportError(
                "docxtpl is required for DOCX template handling. "
                "Install with: pip install docxtpl"
            )

    def extract_variables(self, docx_path: str) -> dict:
        """
        Extract Jinja2 variables from a DOCX template

        Args:
            docx_path: Path to the DOCX file

        Returns:
            dict with:
                - variables: list of unique variable names
                - variableDetails: list of {name, occurrences, contexts}
                - hasTables: whether template contains tables
                - pageCount: estimated page count
        """
        from docxtpl import DocxTemplate
        from docx import Document

        if not os.path.exists(docx_path):
            raise FileNotFoundError(f"Template not found: {docx_path}")

        # Load template with docxtpl to get undeclared variables
        doc = DocxTemplate(docx_path)

        # Get all undeclared template variables
        try:
            jinja_vars = doc.get_undeclared_template_variables()
        except Exception:
            jinja_vars = set()

        # Also manually scan for {{variable}} patterns for more detail
        raw_doc = Document(docx_path)
        all_text = self._extract_all_text(raw_doc)

        # Find all {{variable}} patterns
        pattern = r'\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\s*\}\}'
        matches = re.findall(pattern, all_text)

        # Also check for {% %} control structures
        control_pattern = r'\{%.*?%\}'
        has_control_structures = bool(re.search(control_pattern, all_text))

        # Count occurrences and find contexts
        variable_details = {}
        for var in set(matches):
            contexts = []
            # Find surrounding context for each occurrence
            for match in re.finditer(r'.{0,30}\{\{\s*' + re.escape(var) + r'\s*\}\}.{0,30}', all_text):
                context = match.group(0).strip()
                if context not in contexts:
                    contexts.append(context)

            variable_details[var] = {
                'name': var,
                'occurrences': matches.count(var),
                'contexts': contexts[:3]  # Limit to 3 contexts
            }

        # Merge with jinja_vars (some vars might be in control structures)
        all_vars = set(matches) | jinja_vars

        # Check for tables
        has_tables = len(raw_doc.tables) > 0

        # Estimate page count (rough estimate based on sections)
        page_count = max(1, len(raw_doc.sections))

        return {
            'variables': sorted(list(all_vars)),
            'variableDetails': list(variable_details.values()),
            'hasTables': has_tables,
            'hasControlStructures': has_control_structures,
            'pageCount': page_count
        }

    def _extract_all_text(self, doc) -> str:
        """Extract all text from a DOCX document"""
        texts = []

        # Extract from paragraphs
        for para in doc.paragraphs:
            texts.append(para.text)

        # Extract from tables
        for table in doc.tables:
            for row in table.rows:
                for cell in row.cells:
                    texts.append(cell.text)

        # Extract from headers and footers
        for section in doc.sections:
            if section.header:
                for para in section.header.paragraphs:
                    texts.append(para.text)
            if section.footer:
                for para in section.footer.paragraphs:
                    texts.append(para.text)

        return '\n'.join(texts)

    def validate_template(self, docx_path: str) -> dict:
        """
        Validate a DOCX template for compatibility

        Args:
            docx_path: Path to the DOCX file

        Returns:
            dict with:
                - valid: boolean
                - errors: list of error messages
                - warnings: list of warning messages
        """
        from docxtpl import DocxTemplate

        errors = []
        warnings = []

        if not os.path.exists(docx_path):
            return {
                'valid': False,
                'errors': [f'File not found: {docx_path}'],
                'warnings': []
            }

        # Check file extension
        if not docx_path.lower().endswith('.docx'):
            errors.append('File must be a .docx file')

        # Try to load the template
        try:
            doc = DocxTemplate(docx_path)
        except Exception as e:
            errors.append(f'Failed to parse DOCX: {str(e)}')
            return {
                'valid': False,
                'errors': errors,
                'warnings': warnings
            }

        # Check for variables
        try:
            variables = doc.get_undeclared_template_variables()
            if not variables:
                warnings.append('No template variables found. Are you sure this is a template?')
        except Exception as e:
            warnings.append(f'Could not extract variables: {str(e)}')

        # Check file size (warn if > 10MB)
        file_size = os.path.getsize(docx_path)
        if file_size > 10 * 1024 * 1024:
            warnings.append(f'Large file size ({file_size / 1024 / 1024:.1f}MB). May be slow to process.')

        return {
            'valid': len(errors) == 0,
            'errors': errors,
            'warnings': warnings
        }

    def render_docx(self, template_path: str, data: dict, output_path: str) -> str:
        """
        Render a DOCX template with data

        Args:
            template_path: Path to the DOCX template
            data: Data to fill into the template
            output_path: Where to save the rendered DOCX

        Returns:
            Path to the rendered DOCX file
        """
        from docxtpl import DocxTemplate

        if not os.path.exists(template_path):
            raise FileNotFoundError(f"Template not found: {template_path}")

        # Load template
        doc = DocxTemplate(template_path)

        # Add default context values
        context = {
            'now': datetime.now(),
            'today': datetime.now().strftime('%B %d, %Y'),
            'date': datetime.now().strftime('%Y-%m-%d'),
            **data
        }

        # Render template
        doc.render(context)

        # Ensure output directory exists
        output_dir = os.path.dirname(output_path)
        if output_dir:
            os.makedirs(output_dir, exist_ok=True)

        # Save rendered document
        doc.save(output_path)

        return output_path

    def render_to_pdf(self, template_path: str, data: dict, output_path: str) -> str:
        """
        Render a DOCX template with data and convert to PDF

        Args:
            template_path: Path to the DOCX template
            data: Data to fill into the template
            output_path: Where to save the PDF

        Returns:
            Path to the generated PDF file
        """
        # First render the DOCX
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_docx = os.path.join(temp_dir, 'rendered.docx')
            self.render_docx(template_path, data, temp_docx)

            # Convert to PDF
            return self._convert_to_pdf(temp_docx, output_path)

    def _convert_to_pdf(self, docx_path: str, output_path: str) -> str:
        """
        Convert a DOCX file to PDF

        Tries multiple methods:
        1. docx2pdf library (requires MS Word on Windows, LibreOffice on Linux/Mac)
        2. LibreOffice command line
        3. unoconv
        """
        # Ensure output directory exists
        output_dir = os.path.dirname(output_path)
        if output_dir:
            os.makedirs(output_dir, exist_ok=True)

        # Try docx2pdf first (cross-platform with Word/LibreOffice)
        try:
            from docx2pdf import convert
            convert(docx_path, output_path)
            return output_path
        except ImportError:
            pass
        except Exception as e:
            # docx2pdf failed, try other methods
            pass

        # Try LibreOffice command line
        libreoffice_paths = [
            'soffice',  # If in PATH
            '/usr/bin/soffice',
            '/usr/bin/libreoffice',
            '/Applications/LibreOffice.app/Contents/MacOS/soffice',
            r'C:\Program Files\LibreOffice\program\soffice.exe',
            r'C:\Program Files (x86)\LibreOffice\program\soffice.exe',
        ]

        for lo_path in libreoffice_paths:
            if self._try_libreoffice_convert(lo_path, docx_path, output_path):
                return output_path

        # Try unoconv
        try:
            result = subprocess.run(
                ['unoconv', '-f', 'pdf', '-o', output_path, docx_path],
                capture_output=True,
                timeout=60
            )
            if result.returncode == 0 and os.path.exists(output_path):
                return output_path
        except (FileNotFoundError, subprocess.TimeoutExpired):
            pass

        raise RuntimeError(
            "Could not convert DOCX to PDF. Please install one of:\n"
            "- docx2pdf (pip install docx2pdf) with Microsoft Word or LibreOffice\n"
            "- LibreOffice (https://www.libreoffice.org/)\n"
            "- unoconv (requires LibreOffice)"
        )

    def _try_libreoffice_convert(self, lo_path: str, docx_path: str, output_path: str) -> bool:
        """Try to convert using LibreOffice"""
        try:
            # LibreOffice outputs to input file's directory, so we work in temp
            output_dir = os.path.dirname(output_path)
            docx_name = os.path.basename(docx_path)
            expected_pdf = os.path.join(output_dir, os.path.splitext(docx_name)[0] + '.pdf')

            # Copy docx to output directory for conversion
            temp_docx = os.path.join(output_dir, docx_name)
            if docx_path != temp_docx:
                shutil.copy2(docx_path, temp_docx)

            result = subprocess.run(
                [
                    lo_path,
                    '--headless',
                    '--convert-to', 'pdf',
                    '--outdir', output_dir,
                    temp_docx
                ],
                capture_output=True,
                timeout=60
            )

            # Clean up temp docx if we copied it
            if docx_path != temp_docx and os.path.exists(temp_docx):
                os.remove(temp_docx)

            if result.returncode == 0 and os.path.exists(expected_pdf):
                # Rename to desired output path if different
                if expected_pdf != output_path:
                    shutil.move(expected_pdf, output_path)
                return True

        except (FileNotFoundError, subprocess.TimeoutExpired, PermissionError):
            pass

        return False

    def preview_template(self, template_path: str, sample_data: dict) -> dict:
        """
        Generate a preview of a rendered template

        Args:
            template_path: Path to the DOCX template
            sample_data: Sample data to use for preview

        Returns:
            dict with:
                - html: HTML representation of the document
                - text: Plain text content
                - variables: Variables used in template
        """
        from docxtpl import DocxTemplate
        from docx import Document

        if not os.path.exists(template_path):
            raise FileNotFoundError(f"Template not found: {template_path}")

        # Render to a temp file
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_output = os.path.join(temp_dir, 'preview.docx')
            self.render_docx(template_path, sample_data, temp_output)

            # Read the rendered document
            doc = Document(temp_output)

            # Convert to HTML-like representation
            html_parts = ['<div class="docx-preview">']
            text_parts = []

            for para in doc.paragraphs:
                text = para.text.strip()
                if text:
                    # Detect heading styles
                    style_name = para.style.name.lower() if para.style else ''
                    if 'heading' in style_name:
                        level = 1
                        if '1' in style_name:
                            level = 1
                        elif '2' in style_name:
                            level = 2
                        elif '3' in style_name:
                            level = 3
                        html_parts.append(f'<h{level}>{self._escape_html(text)}</h{level}>')
                    else:
                        html_parts.append(f'<p>{self._escape_html(text)}</p>')
                    text_parts.append(text)

            # Handle tables
            for table in doc.tables:
                html_parts.append('<table border="1" style="border-collapse: collapse; margin: 10px 0;">')
                for row in table.rows:
                    html_parts.append('<tr>')
                    for cell in row.cells:
                        html_parts.append(f'<td style="padding: 5px;">{self._escape_html(cell.text)}</td>')
                    html_parts.append('</tr>')
                html_parts.append('</table>')

            html_parts.append('</div>')

            # Get variables from original template
            orig_doc = DocxTemplate(template_path)
            try:
                variables = list(orig_doc.get_undeclared_template_variables())
            except Exception:
                variables = []

            return {
                'html': '\n'.join(html_parts),
                'text': '\n\n'.join(text_parts),
                'variables': variables
            }

    def _escape_html(self, text: str) -> str:
        """Escape HTML special characters"""
        return (text
            .replace('&', '&amp;')
            .replace('<', '&lt;')
            .replace('>', '&gt;')
            .replace('"', '&quot;')
            .replace("'", '&#39;'))
