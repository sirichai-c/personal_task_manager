# เว็บจัดการงานส่วนตัว

เว็บแอปภาษาไทยสำหรับบันทึก ค้นหา กรอง แก้ไขสถานะ และลบงานส่วนตัวบนเครื่องเดียว ข้อมูลเก็บถาวรใน SQLite และ frontend ติดต่อ Express API จริง ไม่มี mock API หรือระบบบัญชีผู้ใช้

## สิ่งที่ต้องมี

- Windows 10/11
- Node.js 24 ขึ้นไป (ทดสอบด้วย 24.18.0)
- npm 12 ขึ้นไป

## ติดตั้งและตั้งค่า

```powershell
npm install
Copy-Item .env.example .env
npm run db:init
```

ค่าใน `.env`:

| ตัวแปร | ค่าเริ่มต้น | ความหมาย |
| --- | --- | --- |
| `PORT` | `3000` | พอร์ตของ Express API และ production web |
| `HOST` | `127.0.0.1` | bind address; ค่าเริ่มต้นเปิดเฉพาะเครื่องนี้ |
| `TASK_DB_PATH` | `./data/tasks.sqlite` | ตำแหน่งไฟล์ SQLite แบบ relative จาก project root หรือ absolute path |

ระบบสร้าง directory, schema, constraints และ indexes แบบ idempotent ตอน `db:init` หรือเริ่ม server ครั้งแรก ห้าม commit ไฟล์ `.env` หรือฐานข้อมูลใน `data/`; ทั้งสองถูก ignore แล้ว

## รันสำหรับพัฒนา

```powershell
npm run dev
```

เปิด <http://127.0.0.1:5173> โดย Vite จะส่ง `/api` ไป Express ตาม `PORT` ใน `.env` ส่วน API โดยตรงอยู่ที่ <http://127.0.0.1:3000/api/health>

## รัน production build ในเครื่อง

```powershell
npm run build
npm start
```

เปิด <http://127.0.0.1:3000> การรันแบบนี้ให้ Express เสิร์ฟทั้งไฟล์ frontend ที่ build แล้วและ API จาก origin เดียวกัน

ปิด server ด้วย `Ctrl+C` ข้อมูลยังอยู่ในไฟล์ที่กำหนดด้วย `TASK_DB_PATH`

## คำสั่งตรวจสอบ

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run performance
```

หรือรันชุดหลักครั้งเดียวด้วย:

```powershell
npm run check
```

Integration tests สร้าง SQLite ใน temporary directory ของระบบและลบทิ้งหลังทดสอบ จึงไม่แตะฐานข้อมูลใช้งานจริง Performance script ทำเช่นเดียวกันและสร้างข้อมูล 5,000 รายการเฉพาะในฐานข้อมูลชั่วคราว

Browser smoke test ที่ใช้ส่งมอบอยู่ใน `scripts/browser-smoke.py` และ `scripts/run-browser-smoke.py` ทดสอบกับ Chrome แบบ headless ที่ 375px และ 1440px โดย runner บังคับใช้ SQLite ชั่วคราวและไม่แตะฐานข้อมูลใน `.env` หากต้องการรันซ้ำบน Windows ที่ติดตั้ง Chrome ในตำแหน่งมาตรฐาน:

```powershell
python -m pip install --target .browser-tools playwright
$env:PYTHONPATH = (Resolve-Path .browser-tools).Path
python scripts/run-browser-smoke.py
```

## API หลัก

| Method | Path | การทำงาน |
| --- | --- | --- |
| `GET` | `/api/tasks?search=&status=&page=1` | รายการล่าสุดก่อน หน้าละ 20 รายการ |
| `POST` | `/api/tasks` | เพิ่มงานใหม่ สถานะเริ่มต้น `TODO` |
| `PATCH` | `/api/tasks/:id` | แก้ชื่อ รายละเอียด หรือสถานะ |
| `DELETE` | `/api/tasks/:id` | ลบงาน |
| `GET` | `/api/health` | ตรวจว่า server พร้อม |

สถานะที่รองรับคือ `TODO`, `IN_PROGRESS` และ `DONE` ข้อผิดพลาดตอบในรูป `{ "error": { "code", "message", "fields"? } }` โดยไม่ส่ง stack trace กลับไป

## โครงสร้างโปรเจกต์

```text
client/                    React UI และ API client
server/src/routes/         เส้นทาง Express
server/src/controllers/    แปลง HTTP request/response
server/src/services/       validation และกฎงาน
server/src/db/             SQLite migration และ repository
server/tests/              API integration tests
scripts/                   browser smoke test
docs/                      แผน รายงาน AC และผล performance
```

ระบบนี้ตั้งใจให้ใช้คนเดียวบน localhost ไม่มี authentication และไม่ควรนำไปเปิด public network โดยไม่เพิ่มมาตรการความปลอดภัยที่เหมาะสม
