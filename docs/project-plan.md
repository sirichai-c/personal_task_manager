# แผนโครงการเว็บจัดการงานส่วนตัว

อัปเดตล่าสุด: 2026-09-29 — สถานะ: พัฒนา ทดสอบ push และ deploy สำเร็จ

## ขอบเขต

เว็บแอปผู้ใช้คนเดียวสำหรับเพิ่ม ค้นหา กรอง กำหนดวันครบกำหนด แก้ไขสถานะ และลบงาน ข้อมูลเก็บในไฟล์ SQLite และคงอยู่หลังเริ่มเซิร์ฟเวอร์ใหม่ งานหลักไม่รวมบัญชีผู้ใช้ การแชร์ การแจ้งเตือน AI หรือฟีเจอร์อื่นนอกโจทย์ หลังส่งมอบงานหลัก ผู้ใช้ขยายขอบเขตให้ push GitHub, deploy แบบ public และเพิ่มวันครบกำหนดพร้อมตัวกรอง โดยยืนยันให้ไม่มี authentication และยอมรับค่าใช้จ่ายที่อาจเกิดจาก persistent volume

## Acceptance criteria

- **AC-01 เพิ่มงาน:** เมื่อส่งชื่อที่มีอักขระ 1–120 ตัวหลังตัดช่องว่าง ระบบสร้างงานได้ รายละเอียดไม่เกิน 2,000 ตัว วันครบกำหนดไม่บังคับ และสถานะเริ่มต้นเป็น `TODO`
- **AC-02 ตรวจข้อมูล:** backend ปฏิเสธชื่อว่าง ชื่อยาวเกิน รายละเอียดยาวเกิน วันที่ไม่มีอยู่จริง และสถานะนอก `TODO | IN_PROGRESS | DONE` ด้วย HTTP 400 และข้อความที่นำไปแสดงต่อผู้ใช้ได้
- **AC-03 รายการและลำดับ:** API ส่งงานล่าสุดก่อน พร้อม pagination ฝั่ง backend หน้าละ 20 รายการและ metadata ที่ถูกต้อง
- **AC-04 ค้นหาและกรอง:** ค้นหาบางส่วนจากชื่อ กรองสถานะ และกรองกำหนดส่งพร้อมกันได้ โดยผลลัพธ์และจำนวนรวมสอดคล้องกัน
- **AC-05 แก้ไข:** แก้ชื่อ รายละเอียด สถานะ และวันครบกำหนดได้ รวมทั้งล้างวัน เปลี่ยนสถานะย้อนกลับ และบันทึกเวลาปรับปรุง
- **AC-06 ลบอย่างปลอดภัย:** UI ขอคำยืนยันก่อนลบ; ยกเลิกแล้วไม่เรียก API และข้อมูลไม่เปลี่ยน; ยืนยันแล้วงานถูกลบ
- **AC-07 ไม่พบข้อมูล:** แก้ไขหรือลบ id ที่ไม่มีอยู่ได้ HTTP 404 โดยไม่เผย stack trace
- **AC-08 ความถาวร:** งานที่สร้างยังอ่านได้หลังปิดและเปิด database/server ใหม่ด้วยไฟล์เดิม
- **AC-09 ฐานข้อมูล:** schema มี constraints และ indexes ตาม query; ทุกค่าจากผู้ใช้เข้า SQL ผ่าน bound parameters; การสร้าง schema ทำซ้ำได้
- **AC-10 UI responsive:** หน้าจอ 375px และ 1440px ไม่มี horizontal overflow และการทำงานหลักครบ
- **AC-11 สถานะ UI:** มี loading, empty, error และ success states; retry ได้เมื่อโหลดล้มเหลว
- **AC-12 ฟอร์มและ accessibility:** มี label, keyboard focus ชัด, dialog ใช้คีย์บอร์ดได้, ปุ่ม submit ถูกปิดระหว่างรอ และข้อมูลที่กรอกยังอยู่เมื่อบันทึกล้มเหลว
- **AC-13 การเชื่อมจริง:** frontend เรียก Express API และข้อมูลมาจาก SQLite จริง ไม่มี mock/TODO ในเส้นทางหลัก
- **AC-14 การทดสอบ:** automated tests ครอบคลุม validation, CRUD, search, filter, pagination, 404 และ persistence โดยใช้ฐานข้อมูลชั่วคราว
- **AC-15 ประสิทธิภาพ:** ทดสอบ query รายการ/ค้นหากับข้อมูล 5,000 งาน บันทึกเครื่องมือ สภาพแวดล้อม และเวลาที่วัดจริงโดยไม่อ้างการรองรับผู้ใช้จำนวนมาก
- **AC-16 คุณภาพ build:** คำสั่ง lint, typecheck, test และ build ผ่านจริง
- **AC-17 การส่งมอบ:** README ระบุ prerequisites, install, database setup, run, test และ URL; มี `.env.example` เฉพาะค่าที่จำเป็น
- **AC-18 วันครบกำหนด:** แสดงวันนี้/วันที่/เกินกำหนดได้ กรองวันนี้ สัปดาห์จันทร์–อาทิตย์ เกินกำหนด และไม่กำหนดวันได้ โดยงาน `DONE` ไม่ถูกนับว่าเกินกำหนด

## สมมติฐานและการตัดสินใจ

- เป็นโปรเจกต์ใหม่ จึงใช้ React + TypeScript + Vite, Express + TypeScript และ `node:sqlite` ซึ่งมากับ Node 24 เพื่อลด native dependency เพิ่มเติม
- รองรับ Windows ด้วย Node.js 24 LTS ขึ้นไป; เซิร์ฟเวอร์ bind ที่ `127.0.0.1` โดยค่าเริ่มต้น
- วันสร้าง/แก้ไขเก็บเป็น ISO-8601 UTC ส่วนวันครบกำหนดเก็บเป็น date-only `YYYY-MM-DD` เพื่อไม่ให้วันเลื่อนจาก timezone; ลำดับล่าสุดใช้ `created_at DESC, id DESC`
- ค้นหาเป็น substring จาก title; `%`, `_` และ `\\` จากผู้ใช้ถูก escape ก่อนใช้ `LIKE`
- `description` ที่ไม่กรอกเก็บเป็นสตริงว่างเพื่อให้ contract เรียบง่าย
- ขนาดหน้าคงที่ 20 ตามโจทย์; query `page` เริ่มที่ 1
- ไม่มี CORS dependency เพราะ Vite proxy ในโหมดพัฒนาและ Express เสิร์ฟไฟล์ build แบบ same-origin
- `.codex/` เป็นค่าท้องถิ่นเดิมและไม่รวมใน Git

## โครงสร้างข้อมูล

`tasks(id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, description TEXT, status TEXT, due_date TEXT NULL, created_at TEXT, updated_at TEXT)` พร้อม CHECK constraints สำหรับความยาว/สถานะ/รูปแบบวันที่, index สำหรับลำดับ สถานะ และกำหนดส่ง การสร้าง schema ใช้ migration SQL แบบ idempotent ตอนเปิดแอป โดย migration รุ่น 2 เพิ่ม `due_date` แบบ nullable ให้งานเดิมโดยไม่สูญเสียข้อมูล

## สถาปัตยกรรม

- `client/`: React components, API client, form/dialog และ presentation state
- `server/src/routes`: ผูก endpoint กับ controller
- `server/src/controllers`: แปลง HTTP input/output และ error
- `server/src/services`: validation และกฎระบบ
- `server/src/db`: schema, connection และ parameterized repository
- `server/tests`: API integration กับ SQLite ชั่วคราว

## แนวทางภาพและการใช้งาน

- **สี:** Paper `#FFFFFF`, Canvas `#F4F7FB`, Ink `#172033`, Muted `#657189`, Cobalt `#2457D6`, Success `#17745A`, Danger `#B4233A`
- **ตัวอักษร:** `Leelawadee UI`, `Noto Sans Thai`, Tahoma, sans-serif; ใช้ family เดียวเพื่ออ่านภาษาไทยชัดและทำงานออฟไลน์
- **ระยะ:** 4/8/12/16/24/32/48px; เส้นขอบบางและ radius แยกตามหน้าที่ ไม่ใช้ card/shadow ซ้ำทุกส่วน
- **เอกลักษณ์:** หน้าตาเหมือนสมุดงานสะอาด มีเส้นสถานะแนวตั้งบนแต่ละแถวและหัวหน้าที่บอกจำนวนงาน; ใช้สีเด่นเฉพาะ action/status
- **ทบทวนความทั่วไป:** ตัด hero แบบกราฟ/gradient และชุดการ์ดสถิติซึ่งไม่ช่วยงานส่วนตัว เหลือ list-first layout ที่เปิดมาแล้วเริ่มจัดการงานได้ทันที

```text
กว้าง:  [งานของฉัน + จำนวน]                 [เพิ่มงาน]
       [ค้นหา........................] [สถานะ] [ค้นหา]
       ─ งานแถว: สถานะ | ชื่อ/รายละเอียด | วันที่ | แก้ไข ลบ
       ─ งานแถว...
                                      [ก่อนหน้า  1/3  ถัดไป]

มือถือ: งานของฉัน                       [เพิ่ม]
        [ค้นหา.................................]
        [สถานะ........] [ค้นหา]
        ─ สถานะ
          ชื่อ/รายละเอียด
          วันที่             [แก้ไข] [ลบ]
```

## แผนดำเนินงานและสถานะ

1. [x] ตรวจไฟล์ เครื่องมือ และ Git; สร้าง repository
2. [x] กำหนด AC, scope, schema, สถาปัตยกรรม และแนวทาง UI
3. [x] สร้าง backend/database แบบทดสอบได้และ API integration tests (17 tests ผ่าน)
4. [x] สร้าง React UI เชื่อม API ครบเส้นทาง
5. [x] รัน lint, typecheck, test, build และแก้ข้อผิดพลาด (`npm run check` ผ่าน)
6. [x] ทดสอบ Chrome จริงที่ 375px/1440px และเส้นทางหลักผ่าน production build
7. [x] วัด 5,000 รายการ ตรวจ diff และจัดทำรายงาน AC/README
8. [x] Push branch `main` ไป GitHub และเชื่อม Railway auto-deploy
9. [x] ตั้ง production variables, persistent volume `/app/data`, public domain และตรวจ production smoke test
10. [x] เพิ่มวันครบกำหนด ตัวกรองวันนี้/สัปดาห์นี้/เกินกำหนด/ไม่กำหนดวัน และ migration จาก schema เดิม

## ปัญหาค้าง

ไม่มีสิ่งค้างในขอบเขต; ไม่ได้ทำ cross-browser หรือ concurrency test เพราะอยู่นอกเป้าหมายผู้ใช้คนเดียว ไม่ได้เพิ่ม authentication ตามการยืนยันของผู้ใช้ ดังนั้น production URL เป็นสาธารณะและไม่เหมาะกับข้อมูลลับ
