import os
import re


class PDFProcessingError(Exception):
    """Base exception for PDF parsing issues."""
    pass


class PasswordProtectedPDFError(PDFProcessingError):
    """Raised when PDF requires a password."""
    pass


class CorruptPDFError(PDFProcessingError):
    """Raised when PDF structure is corrupt or unreadable."""
    pass


class ScannedPDFError(PDFProcessingError):
    """Raised when PDF contains pages but zero selectable text."""
    pass


def extract_text_from_pdf(pdf_path):
    """
    Robust multi-layered PDF text extraction pipeline.
    Layer 1: pdfplumber (layout-preserving standard extraction)
    Layer 2: pypdfium2 (high-speed Chromium C++ PDFium engine fallback)
    Layer 3: PyPDF2 (pure Python parsing fallback)

    Raises:
        FileNotFoundError: If the file does not exist on disk.
        CorruptPDFError: If file is 0 bytes or structurally broken.
        PasswordProtectedPDFError: If PDF is encrypted/password-protected.
        ScannedPDFError: If PDF contains pages but zero selectable text.
    """
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"PDF file not found at {pdf_path}")

    file_size = os.path.getsize(pdf_path)
    if file_size == 0:
        raise CorruptPDFError("The uploaded PDF file is empty (0 bytes).")

    text = ""
    page_count = 0
    is_encrypted = False

    # -------------------------------------------------------------------------
    # Layer 1: pdfplumber (Layout-Preserving Text Extraction)
    # -------------------------------------------------------------------------
    try:
        import pdfplumber
        with pdfplumber.open(pdf_path) as pdf:
            page_count = len(pdf.pages)
            extracted_pages = []
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text and page_text.strip():
                    extracted_pages.append(page_text.strip())
            if extracted_pages:
                text = "\n\n".join(extracted_pages)
    except Exception as e:
        err_str = str(e).lower()
        if "password" in err_str or "encrypt" in err_str:
            is_encrypted = True

    # -------------------------------------------------------------------------
    # Layer 2: pypdfium2 (Chromium PDFium C++ Engine Fallback)
    # -------------------------------------------------------------------------
    if (not text or not text.strip()) and not is_encrypted:
        try:
            import pypdfium2 as pdfium
            doc = pdfium.PdfDocument(pdf_path)
            page_count = max(page_count, len(doc))
            extracted_pages = []
            for page in doc:
                textpage = page.get_textpage()
                page_str = textpage.get_text_range()
                if page_str and page_str.strip():
                    extracted_pages.append(page_str.strip())
            if extracted_pages:
                text = "\n\n".join(extracted_pages)
        except Exception as e:
            err_str = str(e).lower()
            if "password" in err_str or "encrypt" in err_str:
                is_encrypted = True

    # -------------------------------------------------------------------------
    # Layer 3: PyPDF2 (Pure Python Fallback)
    # -------------------------------------------------------------------------
    if (not text or not text.strip()) and not is_encrypted:
        try:
            import PyPDF2
            with open(pdf_path, "rb") as f:
                reader = PyPDF2.PdfReader(f)
                if getattr(reader, "is_encrypted", False):
                    is_encrypted = True
                else:
                    page_count = max(page_count, len(reader.pages))
                    extracted_pages = []
                    for page in reader.pages:
                        page_str = page.extract_text()
                        if page_str and page_str.strip():
                            extracted_pages.append(page_str.strip())
                    if extracted_pages:
                        text = "\n\n".join(extracted_pages)
        except Exception as e:
            err_str = str(e).lower()
            if "password" in err_str or "encrypt" in err_str:
                is_encrypted = True

    if is_encrypted:
        raise PasswordProtectedPDFError(
            "The uploaded PDF is password-protected. Please remove password protection and try again."
        )

    cleaned_text = text.strip() if text else ""

    if not cleaned_text or len(cleaned_text) < 15:
        if page_count > 0:
            raise ScannedPDFError(
                "The uploaded PDF appears to be a scanned image or contains no selectable text. Please upload a standard text PDF resume."
            )
        else:
            raise CorruptPDFError(
                "Unable to extract text from the PDF file. The document may be corrupted or in an unsupported format."
            )

    return cleaned_text
