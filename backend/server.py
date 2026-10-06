from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse
import json
import mimetypes
import socket
import time


ROOT = Path(__file__).resolve().parents[1]
FRONTEND_DIR = ROOT / "frontend"
DATA_DIR = ROOT / "data"
STUDENTS_FILE = DATA_DIR / "students.json"
ATTENDANCE_FILE = DATA_DIR / "attendance.json"
CLASSES_FILE = DATA_DIR / "classes.json"


DEFAULT_STUDENTS = [
    {"id": "stu_1001", "roll": "01", "name": "Aarav Sharma", "className": "10th A", "guardian": "Ritu Sharma"},
    {"id": "stu_1002", "roll": "02", "name": "Meera Patel", "className": "10th A", "guardian": "Kiran Patel"},
    {"id": "stu_1003", "roll": "03", "name": "Kabir Khan", "className": "10th A", "guardian": "Sana Khan"},
    {"id": "stu_1004", "roll": "04", "name": "Isha Verma", "className": "10th A", "guardian": "Neelam Verma"},
    {"id": "stu_1005", "roll": "05", "name": "Rohan Das", "className": "10th A", "guardian": "Maya Das"},
    {"id": "stu_1791228505467", "roll": "045", "name": "sumit", "className": "10th", "guardian": "babu rao"},
]

DEFAULT_CLASSES = [
    {"date": "2026-10-01", "title": "Maths Class"},
    {"date": "2026-10-02", "title": "Science Class"},
    {"date": "2026-10-03", "title": "English Class"},
    {"date": "2026-10-05", "title": "Revision Class"},
    {"date": "2026-10-06", "title": "Regular Class"},
]

DEFAULT_ATTENDANCE = {
    "2026-10-01": {
        "stu_1001": {"status": "present"},
        "stu_1002": {"status": "present"},
        "stu_1003": {"status": "absent"},
        "stu_1004": {"status": "late"},
        "stu_1005": {"status": "present"},
        "stu_1791228505467": {"status": "present"},
    },
    "2026-10-02": {
        "stu_1001": {"status": "present"},
        "stu_1002": {"status": "absent"},
        "stu_1003": {"status": "present"},
        "stu_1004": {"status": "present"},
        "stu_1005": {"status": "late"},
        "stu_1791228505467": {"status": "absent"},
    },
    "2026-10-03": {
        "stu_1001": {"status": "late"},
        "stu_1002": {"status": "present"},
        "stu_1003": {"status": "present"},
        "stu_1004": {"status": "absent"},
        "stu_1005": {"status": "present"},
        "stu_1791228505467": {"status": "present"},
    },
    "2026-10-05": {
        "stu_1001": {"status": "present"},
        "stu_1002": {"status": "present"},
        "stu_1003": {"status": "present"},
        "stu_1004": {"status": "present"},
        "stu_1005": {"status": "absent"},
        "stu_1791228505467": {"status": "present"},
    },
}


def ensure_data_files():
    DATA_DIR.mkdir(exist_ok=True)
    if not STUDENTS_FILE.exists():
        write_json(STUDENTS_FILE, DEFAULT_STUDENTS)
    if not CLASSES_FILE.exists():
        write_json(CLASSES_FILE, DEFAULT_CLASSES)
    if not ATTENDANCE_FILE.exists() or not is_attendance_shape(ATTENDANCE_FILE):
        write_json(ATTENDANCE_FILE, DEFAULT_ATTENDANCE)


def is_attendance_shape(path):
    try:
        data = read_json(path, {})
        return isinstance(data, dict) and "students" not in data and "attendance" not in data
    except json.JSONDecodeError:
        return False


def read_json(path, default):
    if not path.exists():
        return default
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def write_json(path, data):
    DATA_DIR.mkdir(exist_ok=True)
    temp_path = path.with_suffix(".tmp")
    with temp_path.open("w", encoding="utf-8") as file:
        json.dump(data, file, indent=2)
    temp_path.replace(path)


def read_body(handler):
    length = int(handler.headers.get("Content-Length", "0"))
    if length == 0:
        return {}
    return json.loads(handler.rfile.read(length).decode("utf-8"))


def response_payload():
    return {
        "students": read_json(STUDENTS_FILE, []),
        "classes": sorted(read_json(CLASSES_FILE, []), key=lambda item: item["date"]),
        "attendance": read_json(ATTENDANCE_FILE, {}),
    }


class AttendanceServer(SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/data":
            self.send_json(response_payload())
            return
        if parsed.path.startswith("/api/"):
            self.send_json({"error": "Route not found."}, status=404)
            return
        self.serve_frontend(parsed.path)

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/students":
            self.create_student()
            return
        if parsed.path == "/api/attendance":
            self.save_attendance()
            return
        if parsed.path == "/api/classes":
            self.create_class_day()
            return
        self.send_json({"error": "Route not found."}, status=404)

    def do_DELETE(self):
        parsed = urlparse(self.path)
        parts = parsed.path.strip("/").split("/")
        if len(parts) == 3 and parts[:2] == ["api", "students"]:
            self.delete_student(parts[2])
            return
        self.send_json({"error": "Route not found."}, status=404)

    def create_student(self):
        body = read_body(self)
        roll = str(body.get("roll", "")).strip()
        name = str(body.get("name", "")).strip()
        class_name = str(body.get("className", "")).strip() or "10th A"
        guardian = str(body.get("guardian", "")).strip()

        if not roll or not name:
            self.send_json({"error": "Roll number and student name are required."}, status=400)
            return

        students = read_json(STUDENTS_FILE, [])
        student = {
            "id": f"stu_{int(time.time() * 1000)}",
            "roll": roll,
            "name": name,
            "className": class_name,
            "guardian": guardian,
        }
        students.append(student)
        students.sort(key=lambda item: item["roll"])
        write_json(STUDENTS_FILE, students)
        self.send_json({"student": student, **response_payload()}, status=201)

    def delete_student(self, student_id):
        students = read_json(STUDENTS_FILE, [])
        updated_students = [student for student in students if student["id"] != student_id]
        if len(updated_students) == len(students):
            self.send_json({"error": "Student not found."}, status=404)
            return

        attendance = read_json(ATTENDANCE_FILE, {})
        for records in attendance.values():
            records.pop(student_id, None)

        write_json(STUDENTS_FILE, updated_students)
        write_json(ATTENDANCE_FILE, attendance)
        self.send_json(response_payload())

    def save_attendance(self):
        body = read_body(self)
        date = str(body.get("date", "")).strip()
        records = body.get("records", {})

        if not date:
            self.send_json({"error": "Date is required."}, status=400)
            return
        if not isinstance(records, dict):
            self.send_json({"error": "Attendance records must be an object."}, status=400)
            return

        student_ids = {student["id"] for student in read_json(STUDENTS_FILE, [])}
        clean_records = {}
        for student_id, value in records.items():
            if student_id not in student_ids or not isinstance(value, dict):
                continue
            status = value.get("status", "unmarked")
            if status not in {"present", "absent", "late", "excused", "unmarked"}:
                status = "unmarked"
            clean_records[student_id] = {"status": status}

        attendance = read_json(ATTENDANCE_FILE, {})
        attendance[date] = clean_records
        write_json(ATTENDANCE_FILE, attendance)
        ensure_class_date(date, "Regular Class")
        self.send_json(response_payload())

    def create_class_day(self):
        body = read_body(self)
        date = str(body.get("date", "")).strip()
        title = str(body.get("title", "")).strip() or "Regular Class"
        if not date:
            self.send_json({"error": "Class date is required."}, status=400)
            return
        ensure_class_date(date, title)
        self.send_json(response_payload(), status=201)

    def serve_frontend(self, request_path):
        safe_path = request_path.lstrip("/") or "index.html"
        file_path = (FRONTEND_DIR / safe_path).resolve()
        frontend_root = FRONTEND_DIR.resolve()
        if not str(file_path).startswith(str(frontend_root)) or not file_path.exists() or file_path.is_dir():
            file_path = FRONTEND_DIR / "index.html"

        data = file_path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", mimetypes.guess_type(file_path.name)[0] or "application/octet-stream")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def send_json(self, payload, status=200):
        data = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, format, *args):
        return


def ensure_class_date(date, title):
    classes = read_json(CLASSES_FILE, [])
    if not any(item["date"] == date for item in classes):
        classes.append({"date": date, "title": title})
        classes.sort(key=lambda item: item["date"])
        write_json(CLASSES_FILE, classes)


def find_port():
    for port in range(8000, 8010):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            if sock.connect_ex(("127.0.0.1", port)) != 0:
                return port
    return 8010


if __name__ == "__main__":
    ensure_data_files()
    port = find_port()
    server = ThreadingHTTPServer(("127.0.0.1", port), AttendanceServer)
    print(f"Attendance system running at http://127.0.0.1:{port}")
    server.serve_forever()
