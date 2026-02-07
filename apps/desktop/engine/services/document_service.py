"""
Document Service - PDF and DOCX generation
"""

import os
from datetime import datetime
from pathlib import Path
from typing import Optional

from jinja2 import Environment, FileSystemLoader, select_autoescape


class DocumentService:
    """Service for generating PDF and DOCX documents"""

    def __init__(self, templates_dir: Optional[str] = None):
        if templates_dir is None:
            # Default to templates directory relative to this file
            templates_dir = os.path.join(os.path.dirname(__file__), '..', 'templates')

        self.templates_dir = Path(templates_dir)
        self.env = Environment(
            loader=FileSystemLoader(str(self.templates_dir)),
            autoescape=select_autoescape(['html', 'xml'])
        )

    def generate_pdf(self, template_path: str, data: dict, output_path: str) -> str:
        """
        Generate a PDF document from an HTML template

        Args:
            template_path: Path to the HTML template (relative to templates dir)
            data: Data to inject into the template
            output_path: Where to save the PDF

        Returns:
            Path to the generated PDF
        """
        try:
            from weasyprint import HTML, CSS
        except ImportError:
            raise ImportError("WeasyPrint is required for PDF generation. Install with: pip install weasyprint")

        # Render HTML template
        html_content = self._render_template(template_path, data)

        # Generate PDF
        output_path = self._ensure_output_path(output_path, 'pdf')

        # Create HTML object and write PDF
        html = HTML(string=html_content)
        html.write_pdf(output_path)

        return str(output_path)

    def generate_docx(self, template_path: str, data: dict, output_path: str) -> str:
        """
        Generate a DOCX document

        Args:
            template_path: Path to the template or template name
            data: Data to inject into the document
            output_path: Where to save the DOCX

        Returns:
            Path to the generated DOCX
        """
        try:
            from docx import Document
            from docx.shared import Inches, Pt
            from docx.enum.text import WD_ALIGN_PARAGRAPH
        except ImportError:
            raise ImportError("python-docx is required for DOCX generation. Install with: pip install python-docx")

        output_path = self._ensure_output_path(output_path, 'docx')

        # Create a new document
        doc = Document()

        # Add header if provided
        if 'header' in data:
            header = doc.sections[0].header
            header_para = header.paragraphs[0]
            header_para.text = data['header']
            header_para.alignment = WD_ALIGN_PARAGRAPH.CENTER

        # Add title if provided
        if 'title' in data:
            title = doc.add_heading(data['title'], level=0)
            title.alignment = WD_ALIGN_PARAGRAPH.CENTER

        # Add date
        date_para = doc.add_paragraph()
        date_para.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        date_para.add_run(datetime.now().strftime('%B %d, %Y'))

        # Add recipient info if provided
        if 'recipient_name' in data:
            doc.add_paragraph(data['recipient_name'])
        if 'recipient_title' in data:
            doc.add_paragraph(data['recipient_title'])
        if 'recipient_company' in data:
            doc.add_paragraph(data['recipient_company'])
        if 'recipient_address' in data:
            doc.add_paragraph(data['recipient_address'])

        # Add spacing
        doc.add_paragraph()

        # Add salutation
        if 'salutation' in data:
            doc.add_paragraph(data['salutation'])
        elif 'recipient_name' in data:
            doc.add_paragraph(f"Dear {data['recipient_name']},")

        # Add body content
        if 'body' in data:
            for paragraph in data['body'].split('\n\n'):
                if paragraph.strip():
                    doc.add_paragraph(paragraph.strip())

        # Add closing
        if 'closing' in data:
            doc.add_paragraph()
            doc.add_paragraph(data['closing'])

        # Add signature
        if 'sender_name' in data:
            doc.add_paragraph()
            doc.add_paragraph(data['sender_name'])
        if 'sender_title' in data:
            doc.add_paragraph(data['sender_title'])

        # Add footer if provided
        if 'footer' in data:
            footer = doc.sections[0].footer
            footer_para = footer.paragraphs[0]
            footer_para.text = data['footer']
            footer_para.alignment = WD_ALIGN_PARAGRAPH.CENTER

        # Save document
        doc.save(output_path)

        return str(output_path)

    def _render_template(self, template_path: str, data: dict) -> str:
        """Render an HTML template with data"""
        # Add default context
        context = {
            'now': datetime.now(),
            'today': datetime.now().date(),
            **data
        }

        # Check if it's a file path or inline template
        if os.path.exists(os.path.join(self.templates_dir, template_path)):
            template = self.env.get_template(template_path)
            return template.render(**context)
        else:
            # Treat as inline HTML template
            from jinja2 import Template
            template = Template(template_path)
            return template.render(**context)

    def _ensure_output_path(self, output_path: str, extension: str) -> Path:
        """Ensure output path exists and has correct extension"""
        path = Path(output_path)

        # Add extension if missing
        if not path.suffix:
            path = path.with_suffix(f'.{extension}')

        # Create parent directory if needed
        path.parent.mkdir(parents=True, exist_ok=True)

        return path

    def preview_html(self, template_path: str, data: dict) -> str:
        """
        Generate HTML preview of a document

        Args:
            template_path: Path to the template
            data: Data to inject

        Returns:
            Rendered HTML string
        """
        return self._render_template(template_path, data)
