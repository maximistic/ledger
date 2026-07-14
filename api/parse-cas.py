from http.server import BaseHTTPRequestHandler
import json
import tempfile
import os
import email


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            import casparser

            content_type = self.headers.get('Content-Type', '')
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)

            # Parse multipart/form-data
            msg = email.message_from_bytes(
                b'Content-Type: ' + content_type.encode() + b'\r\n\r\n' + body
            )

            pdf_data = None
            password = ''

            for part in msg.walk():
                disp_name = part.get_param('name', header='content-disposition')
                if disp_name == 'file':
                    pdf_data = part.get_payload(decode=True)
                elif disp_name == 'password':
                    payload = part.get_payload(decode=True)
                    if payload:
                        password = payload.decode('utf-8', errors='replace').strip()

            if not pdf_data:
                self._send_error(400, 'No PDF file provided')
                return

            with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as f:
                f.write(pdf_data)
                tmp_path = f.name

            try:
                data = casparser.read_cas_pdf(tmp_path, password)

                funds = []
                for folio in data.folios:
                    for scheme in folio.schemes:
                        transactions = []
                        for tx in scheme.transactions:
                            transactions.append({
                                'date': str(tx.date),
                                'description': tx.description or '',
                                'amount': float(tx.amount or 0),
                                'units': float(tx.units or 0),
                                'nav': float(tx.nav or 0),
                                'balance': float(tx.balance or 0),
                                'type': tx.type or '',
                            })

                        valuation = scheme.valuation
                        funds.append({
                            'schemeName': scheme.scheme,
                            'isin': scheme.isin or None,
                            'folioNumber': folio.folio or '',
                            'units': float(valuation.units or 0) if valuation else 0,
                            'investedValue': float(valuation.cost or 0) if valuation else 0,
                            'currentValue': float(valuation.value or 0) if valuation else 0,
                            'currentNav': float(valuation.nav or 0) if valuation else 0,
                            'transactions': transactions,
                        })

                response = json.dumps({'funds': funds})
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(response.encode())
            finally:
                try:
                    os.unlink(tmp_path)
                except OSError:
                    pass

        except ImportError:
            self._send_error(500, 'casparser library not installed')
        except Exception as e:
            self._send_error(500, str(e))

    def _send_error(self, code, message):
        body = json.dumps({'error': message}).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        pass  # Suppress default access logs
