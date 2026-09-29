# รายงาน Acceptance Criteria

วันที่ตรวจ: 2026-09-30

| AC | สถานะ | หลักฐานที่รันจริง |
| --- | --- | --- |
| AC-01 เพิ่มงาน | ผ่าน | API test สร้างงาน ตัดช่องว่าง รับวันครบกำหนดที่ไม่บังคับ และได้ `TODO`; browser test เพิ่มจาก UI ถึง SQLite |
| AC-02 ตรวจข้อมูล | ผ่าน | API tests ปฏิเสธ title ว่าง/121 ตัว, description 2,001 ตัว, วันที่ไม่มีอยู่จริง, status/priority/sort ผิด และ tags ผิดรูปแบบด้วย 400 |
| AC-03 รายการและลำดับ | ผ่าน | API test สร้าง 25 งาน ตรวจล่าสุดก่อน หน้าแรก 20 และหน้าสอง 5 |
| AC-04 ค้นหาและกรอง | ผ่าน | API integration และ browser test ใช้ title + status + due date + priority + exact tag ร่วมกัน |
| AC-05 แก้ไข | ผ่าน | API test เปลี่ยน `IN_PROGRESS → DONE → TODO`, ตั้ง/ล้างวันครบกำหนด และแก้ priority/tags; browser test แก้ทุก field |
| AC-06 ลบอย่างปลอดภัย | ผ่าน | browser test กดยกเลิกแล้วงานยังอยู่ จากนั้นยืนยันลบและได้ HTTP 204 |
| AC-07 ไม่พบข้อมูล | ผ่าน | API tests PATCH/DELETE id ที่ไม่มีอยู่ได้ 404 และ response ไม่มี stack |
| AC-08 ความถาวร | ผ่าน | integration test ปิด database/server handle แล้วเปิดไฟล์เดิมและอ่านงานพร้อม priority/tags ได้ |
| AC-09 ฐานข้อมูล | ผ่าน | migration รุ่น 3, CHECK/FK/indexes, bound parameters และ savepoint; งาน schema รุ่น 1 ถูก migrate โดยข้อมูลไม่หาย |
| AC-10 UI responsive | ผ่าน | Chrome headless ที่ 375×812 และ 1440×1000; assert `scrollWidth <= clientWidth`; ตรวจ screenshot จริง |
| AC-11 สถานะ UI | ผ่าน | browser test ตรวจ empty, load error + retry, mutation error และ success toast; loading skeleton อยู่ใน initial fetch path |
| AC-12 ฟอร์ม/accessibility | ผ่าน | browser test ยืนยัน focus ชื่องานหลังเปิด dialog, cancel dialog, disabled ระหว่าง submit และรักษาค่าหลังจำลอง 500 |
| AC-13 การเชื่อมจริง | ผ่าน | production browser test ใช้ React → Express → SQLite แยก; ไม่มี mock ในเส้นทางสำเร็จ |
| AC-14 การทดสอบ | ผ่าน | `npm test`: 1 file, 27 tests ผ่าน ครอบคลุม validation/CRUD/search/combined filters/sorts/due date/tags cleanup/migration/pagination/404/persistence |
| AC-15 ประสิทธิภาพ | ผ่าน | `npm run performance`: 5,000 rows, 20 requests/scenario; ดู `docs/performance-report.md` |
| AC-16 คุณภาพ build | ผ่าน | `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` ผ่านจริง |
| AC-17 การส่งมอบ | ผ่าน | README, `.env.example`, lockfile, database init/run/test instructions และ URL ครบ |
| AC-18 วันครบกำหนด | ผ่าน | API และ browser tests ครอบคลุมวันนี้ สัปดาห์จันทร์–อาทิตย์ เกินกำหนด ไม่กำหนดวัน และไม่จัด `DONE` เป็น overdue |
| AC-19 Priority และ tags | ผ่าน | API/browser tests ครอบคลุมค่าเริ่มต้น, validation, trim/dedupe, create/edit, exact tag filter และ orphan cleanup |
| AC-20 การเรียง | ผ่าน | API test ตรวจ exact order ของทั้ง 4 แบบและ browser test ใช้ตัวเลือก sorting จริง |

## Browser smoke test

Production build ผ่าน Chrome headless ด้วยฐานข้อมูล SQLite ชั่วคราว: priority/tags/sorting, due date/overdue, combined filters, load error/retry, create/edit, cancel/confirm delete, simulated save error/recovery, responsive 375px/1440px และไม่มี uncaught page errors หรือ console errors นอกเหนือจาก HTTP 500 สองครั้งที่ test จำลองโดยตั้งใจ

## Production deployment smoke test

Railway deployment จาก GitHub branch `main` เปิดที่ <https://personal-task-manager-production-57d2.up.railway.app> ทดสอบแล้วว่า `/api/health` ตอบ `{ "status": "ok" }` และ API production สร้าง/แก้ priority กับ tags, กรองร่วม, เรียง, validation และลบได้ครบ ฐานข้อมูลอยู่บน persistent volume `/app/data`; หลังตรวจเสร็จได้ลบข้อมูล smoke test ออกจาก production แล้ว

## ข้อจำกัดของหลักฐาน

- ทดสอบ browser ด้วย Google Chrome บน Windows เครื่องนี้ ไม่ได้ทำ cross-browser matrix
- ทดสอบ performance ในเครื่องเดียวและผู้ใช้เดียว ไม่ได้ทดสอบ concurrency หรือ network จริง
- Production deployment ไม่มี authentication ตามการยืนยันของผู้ใช้ ผู้ที่ทราบ URL จึงเข้าถึงและแก้ไขข้อมูลได้
