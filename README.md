# Attendance Management System

A responsive attendance management project separated into frontend, backend, and JSON data folders.

## Folder Structure

```text
frontend/
  index.html
  styles.css
  app.js

backend/
  server.py

data/
  students.json
  classes.json
  attendance.json
```

## Run

```powershell
python backend\server.py
```

Then open the URL printed in the terminal, usually:

```text
http://127.0.0.1:8000
```

## Features

- Add and delete students.
- Store students in `data/students.json`.
- Store class dates in `data/classes.json`.
- Store date-wise attendance in `data/attendance.json`.
- Mark students as present, absent, late, or excused.
- Show how many class days each student attended.
- Show attendance percentage for each student.
- Calendar view for class days and attendance counts.
- Responsive layout for desktop and mobile.
