# /backend-py/extractor.py
from flask import Flask, request, jsonify
import tempfile
import os
from pdfminer.high_level import extract_text
import zipfile
import xml.etree.ElementTree as ET

app = Flask(__name__)

def extract_text_from_hwpx(file_path):
    with zipfile.ZipFile(file_path, 'r') as hwpx_zip:
        xml_content = hwpx_zip.read('Contents/section0.xml')
        root = ET.fromstring(xml_content)
        paragraphs = root.findall('.//{http://www.hancom.co.kr/hwpml/2011/section}p')
        texts = []
        for p in paragraphs:
            text_runs = p.findall('.//{http://www.hancom.co.kr/hwpml/2011/section}t')
            paragraph_text = ''.join([t.text or '' for t in text_runs])
            texts.append(paragraph_text)
        return '\n'.join(texts)

@app.route('/extract-text', methods=['POST'])
def extract_text_api():
    if 'file' not in request.files:
        return jsonify({'error': '파일이 없습니다.'}), 400
    f = request.files['file']
    filename = f.filename.lower()

    with tempfile.NamedTemporaryFile(delete=False) as tmp:
        f.save(tmp.name)
        tmp_path = tmp.name

    text = ''
    try:
        if filename.endswith('.pdf'):
            text = extract_text(tmp_path)
        elif filename.endswith('.hwpx'):
            text = extract_text_from_hwpx(tmp_path)
        elif filename.endswith('.hwp'):
            # 여기는 pyhwp 설치 및 구현 필요 (권장 별도 스크립트)
            text = "hwp 텍스트 추출은 별도 구현 필요"
        else:
            return jsonify({'error': '지원하지 않는 파일 형식입니다.'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        os.remove(tmp_path)
    return jsonify({'text': text})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001)
