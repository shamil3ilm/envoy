#!/usr/bin/env python3
"""
Envoy - Python Engine
JSON-RPC server for document generation and template rendering
"""

import sys
import json
import re
from typing import Any, Optional
from datetime import datetime

# Print to stderr for logging (stdout is for JSON-RPC)
def log(message: str):
    print(f"[Python Engine] {message}", file=sys.stderr, flush=True)

# Import services
try:
    from services.template_service import TemplateService
    from services.document_service import DocumentService
    from services.safety_service import SafetyService
    from services.docx_template_service import DocxTemplateService
except ImportError as e:
    log(f"Warning: Could not import services: {e}")
    # Define stub classes for when imports fail
    class TemplateService:
        def render(self, template: str, data: dict) -> str:
            from jinja2 import Template
            return Template(template).render(**data)

    class DocumentService:
        def generate_pdf(self, template_path: str, data: dict, output_path: str) -> str:
            raise NotImplementedError("PDF generation requires weasyprint")

        def generate_docx(self, template_path: str, data: dict, output_path: str) -> str:
            raise NotImplementedError("DOCX generation requires python-docx")

    class SafetyService:
        def check_sensitive_data(self, text: str) -> dict:
            return {"hasSensitiveData": False, "findings": []}

    class DocxTemplateService:
        def extract_variables(self, docx_path: str) -> dict:
            raise NotImplementedError("DOCX template parsing requires docxtpl")
        def validate_template(self, docx_path: str) -> dict:
            raise NotImplementedError("DOCX template validation requires docxtpl")
        def render_docx(self, template_path: str, data: dict, output_path: str) -> str:
            raise NotImplementedError("DOCX template rendering requires docxtpl")
        def render_to_pdf(self, template_path: str, data: dict, output_path: str) -> str:
            raise NotImplementedError("DOCX to PDF conversion requires docxtpl and docx2pdf")
        def preview_template(self, template_path: str, sample_data: dict) -> dict:
            raise NotImplementedError("DOCX template preview requires docxtpl")


class JsonRpcServer:
    """Simple JSON-RPC 2.0 server over stdin/stdout"""

    def __init__(self):
        self.template_service = TemplateService()
        self.document_service = DocumentService()
        self.safety_service = SafetyService()
        self.docx_template_service = DocxTemplateService()
        self.methods = {
            "render_template": self.render_template,
            "generate_pdf": self.generate_pdf,
            "generate_docx": self.generate_docx,
            "check_sensitive_data": self.check_sensitive_data,
            "get_version": self.get_version,
            "ping": self.ping,
            # DOCX template methods
            "parse_docx_template": self.parse_docx_template,
            "validate_docx_template": self.validate_docx_template,
            "render_docx_template": self.render_docx_template,
            "preview_docx_template": self.preview_docx_template,
        }

    def handle_request(self, request: dict) -> dict:
        """Handle a single JSON-RPC request"""
        request_id = request.get("id")
        method = request.get("method")
        params = request.get("params", {})

        if method not in self.methods:
            return self.error_response(request_id, -32601, f"Method not found: {method}")

        try:
            result = self.methods[method](**params) if params else self.methods[method]()
            return self.success_response(request_id, result)
        except Exception as e:
            log(f"Error in {method}: {e}")
            return self.error_response(request_id, -32000, str(e))

    def success_response(self, request_id: Any, result: Any) -> dict:
        return {
            "jsonrpc": "2.0",
            "id": request_id,
            "result": result
        }

    def error_response(self, request_id: Any, code: int, message: str) -> dict:
        return {
            "jsonrpc": "2.0",
            "id": request_id,
            "error": {
                "code": code,
                "message": message
            }
        }

    # RPC Methods

    def ping(self) -> dict:
        """Health check"""
        return {"status": "ok", "timestamp": datetime.now().isoformat()}

    def get_version(self) -> dict:
        """Get version information"""
        import platform
        return {
            "python": platform.python_version(),
            "engine": "1.0.0"
        }

    def render_template(self, template: str, data: dict) -> dict:
        """Render a Jinja2 template with data"""
        rendered = self.template_service.render(template, data)
        return {"rendered": rendered}

    def generate_pdf(self, template_path: str, data: dict, output_path: str) -> dict:
        """Generate a PDF document"""
        path = self.document_service.generate_pdf(template_path, data, output_path)
        return {"path": path}

    def generate_docx(self, template_path: str, data: dict, output_path: str) -> dict:
        """Generate a DOCX document"""
        path = self.document_service.generate_docx(template_path, data, output_path)
        return {"path": path}

    def check_sensitive_data(self, text: str) -> dict:
        """Check text for sensitive data patterns"""
        return self.safety_service.check_sensitive_data(text)

    # DOCX Template Methods

    def parse_docx_template(self, docx_path: str) -> dict:
        """Parse a DOCX template and extract variables"""
        return self.docx_template_service.extract_variables(docx_path)

    def validate_docx_template(self, docx_path: str) -> dict:
        """Validate a DOCX template for compatibility"""
        return self.docx_template_service.validate_template(docx_path)

    def render_docx_template(self, template_path: str, data: dict, output_path: str, format: str = "pdf") -> dict:
        """
        Render a DOCX template with data

        Args:
            template_path: Path to the DOCX template
            data: Data to fill into the template
            output_path: Where to save the output
            format: Output format - "pdf" or "docx"

        Returns:
            dict with path to generated file
        """
        if format == "pdf":
            path = self.docx_template_service.render_to_pdf(template_path, data, output_path)
        else:
            path = self.docx_template_service.render_docx(template_path, data, output_path)
        return {"path": path}

    def preview_docx_template(self, template_path: str, sample_data: dict) -> dict:
        """Generate a preview of a DOCX template with sample data"""
        return self.docx_template_service.preview_template(template_path, sample_data)

    def run(self):
        """Main loop - read JSON-RPC requests from stdin, write responses to stdout"""
        log("Python engine ready")
        print("Python engine ready", file=sys.stderr, flush=True)

        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue

            try:
                request = json.loads(line)
                response = self.handle_request(request)
                print(json.dumps(response), flush=True)
            except json.JSONDecodeError as e:
                log(f"Invalid JSON: {e}")
                error = self.error_response(None, -32700, "Parse error")
                print(json.dumps(error), flush=True)


if __name__ == "__main__":
    server = JsonRpcServer()
    server.run()
