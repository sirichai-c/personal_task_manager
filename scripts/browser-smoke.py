from datetime import date, timedelta
from pathlib import Path

from playwright.sync_api import Route, expect, sync_playwright


BASE_URL = "http://127.0.0.1:3000"
CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
ARTIFACTS = Path(".test-artifacts")
TODAY = date.today().isoformat()
YESTERDAY = (date.today() - timedelta(days=1)).isoformat()
NEXT_WEEK = (date.today() + timedelta(days=7)).isoformat()


def assert_no_horizontal_overflow(page, label: str) -> None:
    dimensions = page.evaluate(
        """() => ({
            viewport: document.documentElement.clientWidth,
            scroll: document.documentElement.scrollWidth
        })"""
    )
    assert dimensions["scroll"] <= dimensions["viewport"], (
        f"{label} has horizontal overflow: {dimensions}"
    )


ARTIFACTS.mkdir(parents=True, exist_ok=True)
console_errors: list[str] = []
page_errors: list[str] = []

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(
        headless=True,
        executable_path=CHROME_PATH,
        args=["--disable-extensions"],
    )
    desktop = browser.new_context(viewport={"width": 1440, "height": 1000})
    page = desktop.new_page()
    page.on(
        "console",
        lambda message: console_errors.append(message.text)
        if message.type == "error"
        else None,
    )
    page.on("pageerror", lambda error: page_errors.append(str(error)))

    initial_list_failed = {"value": False}

    def fail_first_list(route: Route) -> None:
        if route.request.method == "GET" and not initial_list_failed["value"]:
            initial_list_failed["value"] = True
            route.fulfill(
                status=500,
                content_type="application/json",
                body='{"error":{"code":"TEST_FAILURE","message":"โหลดทดสอบไม่สำเร็จ"}}',
            )
        else:
            route.continue_()

    page.route("**/api/tasks?*", fail_first_list)
    page.goto(BASE_URL)
    page.wait_for_load_state("networkidle")
    expect(page.get_by_role("heading", name="งานของฉัน")).to_be_visible()
    expect(page.get_by_text("โหลดรายการไม่สำเร็จ", exact=True)).to_be_visible()
    expect(page.get_by_text("โหลดทดสอบไม่สำเร็จ", exact=True)).to_be_visible()
    page.unroute("**/api/tasks?*", fail_first_list)
    page.get_by_role("button", name="ลองอีกครั้ง").click()
    page.wait_for_load_state("networkidle")
    expect(page.get_by_role("heading", name="ยังไม่มีงานในรายการ")).to_be_visible()
    assert_no_horizontal_overflow(page, "desktop empty state")

    page.get_by_role("button", name="เพิ่มงาน", exact=True).first.click()
    dialog = page.locator("dialog[open]")
    expect(dialog).to_be_visible()
    title_input = dialog.get_by_label("ชื่องาน")
    expect(title_input).to_be_focused()
    title_input.fill("งานทดสอบผ่านเบราว์เซอร์")
    dialog.get_by_label("รายละเอียด").fill("ตรวจเส้นทางจากหน้าเว็บถึง SQLite")
    dialog.get_by_label("วันครบกำหนด").fill(TODAY)
    dialog.get_by_label("ทำซ้ำ").select_option("WEEKLY")
    dialog.get_by_label("ความสำคัญ").select_option("HIGH")
    dialog.get_by_label("แท็ก").fill("งาน, ด่วน")
    with page.expect_response(
        lambda response: response.url.endswith("/api/tasks")
        and response.request.method == "POST"
    ) as create_response:
        dialog.get_by_role("button", name="เพิ่มงาน", exact=True).click()
    assert create_response.value.status == 201
    expect(page.locator(".toast", has_text="เพิ่มงานแล้ว")).to_be_visible()
    created_row = page.locator(".task-row", has_text="งานทดสอบผ่านเบราว์เซอร์")
    expect(created_row).to_be_visible()
    expect(created_row.get_by_text("ครบกำหนดวันนี้", exact=True)).to_be_visible()
    expect(created_row.get_by_text("สำคัญสูง", exact=True)).to_be_visible()
    expect(created_row.get_by_label("ทำซ้ำ ทุกสัปดาห์")).to_be_visible()
    expect(created_row.get_by_text("งาน", exact=True)).to_be_visible()
    expect(created_row.get_by_text("ด่วน", exact=True)).to_be_visible()

    checklist = created_row.locator(".checklist")
    checklist.locator("summary").click()
    expect(checklist.get_by_text("ยังไม่มีรายการ", exact=True)).to_be_visible()
    checklist.get_by_label("เพิ่มรายการย่อย").fill("รวบรวมข้อมูล")
    with page.expect_response(
        lambda response: "/subtasks" in response.url
        and response.request.method == "POST"
    ) as first_subtask_response:
        checklist.get_by_role("button", name="เพิ่ม", exact=True).click()
    assert first_subtask_response.value.status == 201
    checklist.get_by_label("เพิ่มรายการย่อย").fill("ทำสไลด์")
    with page.expect_response(
        lambda response: "/subtasks" in response.url
        and response.request.method == "POST"
    ) as second_subtask_response:
        checklist.get_by_role("button", name="เพิ่ม", exact=True).click()
    assert second_subtask_response.value.status == 201
    expect(checklist.get_by_text("เสร็จแล้ว 0/2", exact=True)).to_be_visible()

    first_checkbox = checklist.get_by_role("checkbox", name="รวบรวมข้อมูล")
    with page.expect_response(
        lambda response: "/subtasks/" in response.url
        and response.request.method == "PATCH"
    ) as complete_subtask_response:
        first_checkbox.check()
    assert complete_subtask_response.value.status == 200
    expect(first_checkbox).to_be_checked()
    expect(checklist.get_by_text("เสร็จแล้ว 1/2", exact=True)).to_be_visible()

    second_subtask_row = checklist.locator(".subtask-list li", has_text="ทำสไลด์")
    second_subtask_row.get_by_role("button", name="แก้ไข", exact=True).click()
    edit_subtask_form = checklist.locator(".subtask-edit-form")
    expect(edit_subtask_form).to_be_visible()
    edit_subtask_form.locator("input").fill("ทำสไลด์สรุป")
    with page.expect_response(
        lambda response: "/subtasks/" in response.url
        and response.request.method == "PATCH"
    ) as edit_subtask_response:
        edit_subtask_form.get_by_role("button", name="บันทึก", exact=True).click()
    assert edit_subtask_response.value.status == 200
    expect(checklist.get_by_text("ทำสไลด์สรุป", exact=True)).to_be_visible()

    second_subtask_row = checklist.locator(
        ".subtask-list li", has_text="ทำสไลด์สรุป"
    )
    second_subtask_row.get_by_role("button", name="ลบ", exact=True).click()
    expect(
        second_subtask_row.get_by_role("button", name="ยืนยันลบ", exact=True)
    ).to_be_visible()
    with page.expect_response(
        lambda response: "/subtasks/" in response.url
        and response.request.method == "DELETE"
    ) as delete_subtask_response:
        second_subtask_row.get_by_role(
            "button", name="ยืนยันลบ", exact=True
        ).click()
    assert delete_subtask_response.value.status == 204
    expect(checklist.get_by_text("เสร็จแล้ว 1/1", exact=True)).to_be_visible()

    created_row.locator(".task-actions").get_by_role(
        "button", name="แก้ไข", exact=True
    ).click()
    edit_dialog = page.locator("dialog[open]")
    edit_dialog.get_by_label("ชื่องาน").fill("งานทดสอบผ่านเบราว์เซอร์ แก้ไข")
    edit_dialog.get_by_label("รายละเอียด").fill("แก้ไขรายละเอียดและสถานะสำเร็จ")
    edit_dialog.get_by_label("สถานะ").select_option("DONE")
    edit_dialog.get_by_label("ความสำคัญ").select_option("LOW")
    edit_dialog.get_by_label("แท็ก").fill("ส่วนตัว, ตรวจสอบ")
    with page.expect_response(
        lambda response: "/api/tasks/" in response.url
        and response.request.method == "PATCH"
    ) as update_response:
        edit_dialog.get_by_role("button", name="บันทึกการแก้ไข").click()
    assert update_response.value.status == 200
    update_payload = update_response.value.json()
    assert update_payload["nextItem"]["dueDate"] == NEXT_WEEK
    assert update_payload["nextItem"]["status"] == "TODO"
    assert update_payload["nextItem"]["recurrence"] == "WEEKLY"
    next_subtasks = update_payload["nextItem"]["subtasks"]
    assert len(next_subtasks) == 1
    assert next_subtasks[0]["title"] == "รวบรวมข้อมูล"
    assert next_subtasks[0]["completed"] is False
    expect(
        page.locator(".toast", has_text="สร้างงานรอบถัดไปแล้ว")
    ).to_be_visible()
    edited_row = page.locator(
        ".task-row:has(.status-badge.status-done)",
        has_text="งานทดสอบผ่านเบราว์เซอร์ แก้ไข",
    )
    next_recurring_row = page.locator(
        ".task-row:has(.status-badge.status-todo)",
        has_text="งานทดสอบผ่านเบราว์เซอร์ แก้ไข",
    )
    expect(edited_row.get_by_text("เสร็จแล้ว", exact=True)).to_be_visible()
    expect(edited_row.get_by_text("สำคัญต่ำ", exact=True)).to_be_visible()
    expect(edited_row.get_by_text("ส่วนตัว", exact=True)).to_be_visible()
    expect(next_recurring_row).to_be_visible()
    expect(next_recurring_row.locator("time.due-date")).to_have_attribute(
        "datetime", NEXT_WEEK
    )
    expect(next_recurring_row.get_by_label("ทำซ้ำ ทุกสัปดาห์")).to_be_visible()
    expect(next_recurring_row.get_by_text("เสร็จแล้ว 0/1", exact=True)).to_be_visible()

    page.get_by_label("สถานะ").select_option("DONE")
    page.get_by_label("กำหนดส่ง").select_option("TODAY")
    page.get_by_label("ความสำคัญ").select_option("LOW")
    page.locator("#tag-filter").fill("ส่วนตัว")
    page.get_by_label("เรียงตาม").select_option("PRIORITY_DESC")
    page.get_by_label("ค้นหาจากชื่องาน").fill("ผ่านเบราว์เซอร์")
    page.get_by_role("button", name="ค้นหา", exact=True).click()
    page.wait_for_load_state("networkidle")
    expect(edited_row).to_be_visible()
    expect(page.locator(".task-row")).to_have_count(1)

    edited_row.locator(".task-actions").get_by_role(
        "button", name="ลบ", exact=True
    ).click()
    confirm_dialog = page.locator("dialog[open]")
    expect(confirm_dialog.get_by_role("heading", name="ลบงานนี้หรือไม่")).to_be_visible()
    confirm_dialog.get_by_role("button", name="เก็บงานไว้").click()
    expect(confirm_dialog).not_to_be_visible()
    expect(edited_row).to_be_visible()

    edited_row.locator(".task-actions").get_by_role(
        "button", name="ลบ", exact=True
    ).click()
    confirm_dialog = page.locator("dialog[open]")
    with page.expect_response(
        lambda response: "/api/tasks/" in response.url
        and response.request.method == "DELETE"
    ) as delete_response:
        confirm_dialog.get_by_role("button", name="ลบงาน", exact=True).click()
    assert delete_response.value.status == 204
    expect(page.get_by_role("heading", name="ไม่พบงานที่ตรงกัน")).to_be_visible()

    page.get_by_role("button", name="ล้างตัวกรอง", exact=True).first.click()
    page.get_by_role("button", name="เพิ่มงาน", exact=True).first.click()
    error_dialog = page.locator("dialog[open]")
    preserved_title = "งานที่ต้องคงข้อมูลเมื่อบันทึกล้มเหลว"
    error_dialog.get_by_label("ชื่องาน").fill(preserved_title)
    error_dialog.get_by_label("รายละเอียด").fill("ข้อความนี้ต้องยังอยู่ในฟอร์ม")
    error_dialog.get_by_label("วันครบกำหนด").fill(YESTERDAY)
    error_dialog.get_by_label("ความสำคัญ").select_option("HIGH")
    error_dialog.get_by_label("แท็ก").fill("ข้อผิดพลาด, ทดสอบ")

    failed_once = {"value": False}

    def fail_first_create(route: Route) -> None:
        if route.request.method == "POST" and not failed_once["value"]:
            failed_once["value"] = True
            route.fulfill(
                status=500,
                content_type="application/json",
                body='{"error":{"code":"TEST_FAILURE","message":"ทดสอบข้อผิดพลาด"}}',
            )
        else:
            route.continue_()

    page.route("**/api/tasks", fail_first_create)
    error_dialog.get_by_role("button", name="เพิ่มงาน", exact=True).click()
    expect(error_dialog.get_by_text("ทดสอบข้อผิดพลาด", exact=True)).to_be_visible()
    expect(error_dialog.get_by_label("ชื่องาน")).to_have_value(preserved_title)
    expect(error_dialog.get_by_label("รายละเอียด")).to_have_value(
        "ข้อความนี้ต้องยังอยู่ในฟอร์ม"
    )
    expect(error_dialog.get_by_label("วันครบกำหนด")).to_have_value(YESTERDAY)
    expect(error_dialog.get_by_label("ความสำคัญ")).to_have_value("HIGH")
    expect(error_dialog.get_by_label("แท็ก")).to_have_value("ข้อผิดพลาด, ทดสอบ")
    page.unroute("**/api/tasks", fail_first_create)

    with page.expect_response(
        lambda response: response.url.endswith("/api/tasks")
        and response.request.method == "POST"
    ) as retry_response:
        error_dialog.get_by_role("button", name="เพิ่มงาน", exact=True).click()
    assert retry_response.value.status == 201
    final_row = page.locator(".task-row", has_text=preserved_title)
    expect(final_row).to_be_visible()
    expect(final_row.get_by_text("เกินกำหนด", exact=False)).to_be_visible()
    expect(final_row.get_by_text("สำคัญสูง", exact=True)).to_be_visible()
    expect(final_row.get_by_text("ข้อผิดพลาด", exact=True)).to_be_visible()
    final_checklist = final_row.locator(".checklist")
    final_checklist.locator("summary").click()
    final_checklist.get_by_label("เพิ่มรายการย่อย").fill("ตรวจงานบนมือถือ")
    with page.expect_response(
        lambda response: "/subtasks" in response.url
        and response.request.method == "POST"
    ) as mobile_subtask_response:
        final_checklist.get_by_role("button", name="เพิ่ม", exact=True).click()
    assert mobile_subtask_response.value.status == 201
    expect(final_checklist.get_by_text("เสร็จแล้ว 0/1", exact=True)).to_be_visible()
    page.get_by_label("กำหนดส่ง").select_option("OVERDUE")
    page.locator("#tag-filter").fill("ทดสอบ")
    page.get_by_role("button", name="ค้นหา", exact=True).click()
    page.get_by_label("เรียงตาม").select_option("DUE_ASC")
    page.wait_for_load_state("networkidle")
    expect(final_row).to_be_visible()
    expect(page.locator(".task-row")).to_have_count(1)
    assert_no_horizontal_overflow(page, "desktop populated state")
    page.screenshot(path=str(ARTIFACTS / "desktop-1440.png"), full_page=True)

    mobile = browser.new_context(viewport={"width": 375, "height": 812})
    mobile_page = mobile.new_page()
    mobile_page.on(
        "console",
        lambda message: console_errors.append(f"mobile: {message.text}")
        if message.type == "error"
        else None,
    )
    mobile_page.on("pageerror", lambda error: page_errors.append(f"mobile: {error}"))
    mobile_page.goto(BASE_URL)
    mobile_page.wait_for_load_state("networkidle")
    expect(mobile_page.get_by_role("heading", name="งานของฉัน")).to_be_visible()
    mobile_row = mobile_page.locator(".task-row", has_text=preserved_title)
    expect(mobile_row).to_be_visible()
    expect(mobile_row.get_by_text("เกินกำหนด", exact=False)).to_be_visible()
    expect(mobile_row.get_by_text("สำคัญสูง", exact=True)).to_be_visible()
    expect(mobile_row.get_by_text("ทดสอบ", exact=True)).to_be_visible()
    mobile_checklist = mobile_row.locator(".checklist")
    mobile_checklist.locator("summary").click()
    expect(mobile_checklist.get_by_text("ตรวจงานบนมือถือ", exact=True)).to_be_visible()
    expect(mobile_checklist.get_by_text("เสร็จแล้ว 0/1", exact=True)).to_be_visible()
    assert_no_horizontal_overflow(mobile_page, "mobile populated state")
    mobile_page.screenshot(path=str(ARTIFACTS / "mobile-375.png"), full_page=True)

    mobile.close()
    desktop.close()
    browser.close()

expected_test_errors = [
    message for message in console_errors if "status of 500" in message
]
unexpected_console_errors = [
    message for message in console_errors if "status of 500" not in message
]
assert len(expected_test_errors) == 2, (
    f"Expected two simulated HTTP 500 console entries, got: {console_errors}"
)
assert not unexpected_console_errors, (
    f"Unexpected browser console errors: {unexpected_console_errors}"
)
assert not page_errors, f"Uncaught page errors: {page_errors}"
print("Browser smoke test passed: recurring next task, reset subtasks, priority, tags, sorting, due dates, filters, error recovery, 375px, 1440px")
