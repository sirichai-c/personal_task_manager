# รายงาน Acceptance Criteria

วันที่ตรวจ: 2026-10-04

| AC | สถานะ | หลักฐานที่รันจริง |
| --- | --- | --- |
| AC-01 เพิ่มงาน | ผ่าน | API test สร้างงาน ตัดช่องว่าง รับวันครบกำหนดที่ไม่บังคับ และได้ `TODO`; browser test เพิ่มจาก UI ถึง SQLite |
| AC-02 ตรวจข้อมูล | ผ่าน | API tests ปฏิเสธ title ว่าง/121 ตัว, description 2,001 ตัว, วันที่ไม่มีอยู่จริง, status/priority/sort/recurrence/reminder ผิด, tags ผิดรูปแบบ และงานซ้ำ/งานเตือนที่ไม่มีวันด้วย 400 |
| AC-03 รายการและลำดับ | ผ่าน | API test สร้าง 25 งาน ตรวจล่าสุดก่อน หน้าแรก 20 และหน้าสอง 5 |
| AC-04 ค้นหาและกรอง | ผ่าน | API integration และ browser test ใช้ title + status + due date + priority + exact tag ร่วมกัน |
| AC-05 แก้ไข | ผ่าน | API test เปลี่ยน `IN_PROGRESS → DONE → TODO`, ตั้ง/ล้างวันครบกำหนด และแก้ priority/tags; browser test แก้ทุก field |
| AC-06 ลบอย่างปลอดภัย | ผ่าน | browser test กดยกเลิกแล้วงานยังอยู่ จากนั้นยืนยันลบและได้ HTTP 204 |
| AC-07 ไม่พบข้อมูล | ผ่าน | API tests PATCH/DELETE id ที่ไม่มีอยู่ได้ 404 และ response ไม่มี stack |
| AC-08 ความถาวร | ผ่าน | integration test ปิด database/server handle แล้วเปิดไฟล์เดิมและอ่านงานพร้อม priority/tags ได้ |
| AC-09 ฐานข้อมูล | ผ่าน | migration ถึงรุ่น 6, CHECK/FK/partial indexes, bound parameters และ savepoint; งาน schema รุ่น 1 ถูก migrate โดยข้อมูลไม่หาย |
| AC-10 UI responsive | ผ่าน | Chrome headless ที่ 375×812 และ 1440×1000; assert `scrollWidth <= clientWidth`; ตรวจ screenshot จริง |
| AC-11 สถานะ UI | ผ่าน | browser test ตรวจ empty, load error + retry, mutation error และ success toast; loading skeleton อยู่ใน initial fetch path |
| AC-12 ฟอร์ม/accessibility | ผ่าน | browser test ยืนยัน focus ชื่องานหลังเปิด dialog, cancel dialog, disabled ระหว่าง submit และรักษาค่าหลังจำลอง 500 |
| AC-13 การเชื่อมจริง | ผ่าน | browser test บน production build ใช้ React → Express → SQLite จริง; ไม่มี mock ในเส้นทางสำเร็จ |
| AC-14 การทดสอบ | ผ่าน | `npm test`: 1 file, 48 tests ผ่าน ครอบคลุม validation/CRUD/search/filters/sorts/due date/tags/subtasks/recurrence/reminders/calendar/dismiss/cascade/migration/pagination/404/persistence |
| AC-15 ประสิทธิภาพ | ผ่าน | `npm run performance`: 5,000 rows, 20 requests/scenario; ดู `docs/performance-report.md` |
| AC-16 คุณภาพ build | ผ่าน | `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` ผ่านจริง |
| AC-17 การส่งมอบ | ผ่าน | README, `.env.example`, lockfile, database init/run/test instructions และ URL ครบ |
| AC-18 วันครบกำหนด | ผ่าน | API และ browser tests ครอบคลุมวันนี้ สัปดาห์จันทร์–อาทิตย์ เกินกำหนด ไม่กำหนดวัน และไม่จัด `DONE` เป็น overdue |
| AC-19 Priority และ tags | ผ่าน | API/browser tests ครอบคลุมค่าเริ่มต้น, validation, trim/dedupe, create/edit, exact tag filter และ orphan cleanup |
| AC-20 การเรียง | ผ่าน | API test ตรวจ exact order ของทั้ง 4 แบบและ browser test ใช้ตัวเลือก sorting จริง |
| AC-21 Checklist | ผ่าน | API/browser tests ครอบคลุมเพิ่ม ติ๊ก แก้ชื่อ ยืนยันลบ progress, limit 30, nested 404, cascade delete และ persistence |
| AC-22 งานทำซ้ำ | ผ่าน | API/browser tests ครอบคลุม create/edit/validation, daily/weekly/monthly, สิ้นเดือน/ข้ามปี/ปีอธิกสุรทิน, สร้างรอบถัดไปหนึ่งครั้ง, คัดลอก tags และ reset checklist |
| AC-23 การเตือน | ผ่าน | API/browser tests ครอบคลุมการเตือน 0/1/3/7 วัน, งานเกินกำหนด, ไม่รวมงานเสร็จ/ยังไม่ถึงเวลา, validation, เปิดงาน, persistent dismiss, reactivation เมื่อเลื่อนวัน และคัดลอกสู่งานซ้ำรอบใหม่ |
| AC-24 ปฏิทินรายเดือน | ผ่าน | API tests ตรวจขอบเขตต้น/กลาง/สิ้นเดือน, ไม่รวมเดือนข้างเคียง/งานไม่มีวัน, รวม `DONE`, ค่าเดือนปัจจุบันและ validation; Chrome ตรวจเปลี่ยนเดือน/กลับเดือนนี้/เปิดงาน, grid 1440px และ agenda 375px |

## Browser smoke test

Production build ผ่าน Chrome headless ด้วยฐานข้อมูล SQLite ชั่วคราว: ปฏิทินเปลี่ยนเดือน/กลับเดือนนี้/เปิดงาน, desktop grid, mobile agenda, ตั้งเตือนล่วงหน้า 7 วัน, แสดงศูนย์เตือน, เปิดงาน, ซ่อนและ reload แล้วยังซ่อนอยู่, งานรายสัปดาห์รอบใหม่ได้รับการเตือนโดยไม่รับสถานะซ่อน, รวมทั้ง checklist เพิ่ม/ติ๊ก/แก้/ยืนยันลบ/progress, priority/tags/sorting, due date/overdue, combined filters, load error/retry, task create/edit/delete, simulated save error/recovery, responsive 375px/1440px และไม่มี horizontal overflow, uncaught page errors หรือ console errors นอกเหนือจาก HTTP 500 สองครั้งที่ test จำลองโดยตั้งใจ

## Production deployment smoke test

Railway deployment `a3dea6ad-7422-4b44-a462-23df57b01f36` จาก feature commit `664143a` สำเร็จ ตรวจแล้วว่า `/api/health` ตอบ `{ "status": "ok" }` และ frontend asset ตรงกับ local build (`index-CGsh0Zxg.js`) Production API ผ่าน validation 400 เมื่อเปิดเตือนโดยไม่มีวัน, การเตือน 0/1/3/7 วัน, ไม่คืนงานที่ยังไม่ถึงเวลาหรือเสร็จแล้ว, persistent dismiss, reactivation เมื่อเลื่อนวัน, งาน `WEEKLY` รอบใหม่คัดลอกเตือนล่วงหน้า 3 วันและ reset checklist โดยไม่รับสถานะซ่อน รวมทั้ง PATCH `DONE` ซ้ำไม่สร้างลูกซ้ำ จากนั้นลบ smoke data 6 งานตาม UUID prefix และยืนยันผลค้นหา 0 รายการโดยไม่แตะข้อมูลอื่นใน persistent volume `/app/data`

## ข้อจำกัดของหลักฐาน

- ทดสอบ browser ด้วย Google Chrome บน Windows เครื่องนี้ ไม่ได้ทำ cross-browser matrix
- ทดสอบ performance ในเครื่องเดียวและผู้ใช้เดียว ไม่ได้ทดสอบ concurrency หรือ network จริง
- Production deployment ไม่มี authentication ตามการยืนยันของผู้ใช้ ผู้ที่ทราบ URL จึงเข้าถึงและแก้ไขข้อมูลได้
