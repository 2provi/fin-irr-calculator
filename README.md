# 2PROVI Tools — เครื่องมือวางแผนการเงิน

เว็บไซต์สแตติก 4 หน้า ใช้งานได้ทั้งบนมือถือ iPad และคอมพิวเตอร์ ไม่ต้องใช้เซิร์ฟเวอร์

| ไฟล์ | หน้า |
|---|---|
| `index.html` | หน้าแรก (hub) ลิงก์ไปทั้ง 3 เครื่องมือ |
| `irr.html` | คำนวณ IRR ประกันชีวิต |
| `fna.html` | FNA — วิเคราะห์ความต้องการทางการเงิน |
| `savings.html` | วางแผนเงินออม |
| `assets/theme.css` | ธีมและคอมโพเนนต์ที่ใช้ร่วมกันทุกหน้า (Light/Dark) |
| `assets/common.js` | สคริปต์ร่วม — ธีม, ฟอร์แมตตัวเลข, toast/modal, แท็บ, ส่งออก PDF |

> **สำคัญ:** ทั้ง 4 หน้าเรียกใช้โฟลเดอร์ `assets/` ต้องอัปโหลดขึ้นไปพร้อมกันเสมอ

---

## วิธีขึ้น GitHub Pages

1. สร้าง repository ใหม่บน GitHub (เช่น ชื่อ `2provi-tools`) ตั้งเป็น **Public**
2. อัปโหลดไฟล์ทั้งหมดในโฟลเดอร์นี้ไว้ที่ **ราก** ของ repo (ลาก `index.html`, `irr.html`, `fna.html`, `savings.html` และโฟลเดอร์ `assets` เข้าไปพร้อมกัน)
3. ไปที่ **Settings → Pages**
   - Source: `Deploy from a branch`
   - Branch: `main` · Folder: `/ (root)` → กด **Save**
4. รอประมาณ 1–2 นาที เว็บจะขึ้นที่
   `https://<ชื่อบัญชี>.github.io/<ชื่อ-repo>/`

### ผ่าน Git command line

```bash
git init
git add .
git commit -m "2PROVI financial tools"
git branch -M main
git remote add origin https://github.com/<ชื่อบัญชี>/<ชื่อ-repo>.git
git push -u origin main
```

---

## ถ้ายังอยากฝังบน Google Sites

ใช้ **Embed → By URL** ชี้ไปที่ลิงก์ GitHub Pages ของแต่ละหน้า **อย่าใช้ Embed code**
เพราะ Google Sites จะวางโค้ดไว้ใน `<iframe sandbox>` ที่ปิด `allow-modals` และ
`allow-popups` ทำให้ `window.print()`, `alert()`, `confirm()` และ `navigator.clipboard`
ถูกบล็อกเงียบๆ — นี่คือสาเหตุที่ปุ่มพิมพ์กดแล้วไม่ทำงานในเวอร์ชันเดิม

เวอร์ชันนี้เลี่ยงฟังก์ชันเหล่านั้นทั้งหมดแล้ว (ใช้ toast/modal ที่เขียนเองแทน)
แต่การเปิดเป็นหน้าเว็บเต็มจะให้ประสบการณ์ที่ดีที่สุด โดยเฉพาะการบันทึก PDF

---

## หมายเหตุทางเทคนิค

- **ฟอนต์** โหลดจาก Google Fonts ถ้าเน็ตช้าจะ fallback เป็นฟอนต์ระบบโดยอัตโนมัติ
- **PDF** สร้างฝั่งเบราว์เซอร์ด้วย `html2canvas` + `jsPDF` โหลดจาก cdnjs เฉพาะตอนกดปุ่ม
  ถ้าโหลดไม่ได้จะถอยไปใช้หน้าต่างพิมพ์ของระบบให้เอง
- **ธีม** ค่าเริ่มต้นเป็นโหมดมืด เก็บค่าที่ผู้ใช้เลือกไว้ใน `localStorage`
  (ห่อ try/catch ไว้แล้ว จึงไม่พังในโหมดส่วนตัวหรือใน iframe)
- **ไม่มีการส่งข้อมูลออกนอกเครื่อง** ทุกการคำนวณทำในเบราว์เซอร์ทั้งหมด
