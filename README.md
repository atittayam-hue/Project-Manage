# TaskPulse — Real-Time Kanban & Project Workspace

เว็บแอปจัดการโปรเจกต์และติดตามสถานะงานแบบเรียลไทม์ที่ได้แรงบันดาลใจจาก ClickUp พัฒนาด้วย React 19, TypeScript, Tailwind CSS v4, Express และ WebSocket (`ws`) **ใช้งานได้ฟรี 100% ไม่มีฟังก์ชันติด Paywall** และพร้อมเชื่อมต่อ/ส่งออกไปยัง GitHub ได้อย่างสมบูรณ์

## คุณสมบัติหลัก (Features)

- **Real-Time WebSocket Sync**: อัปเดตสถานะงาน ลากวางการ์ด เพิ่มคอมเมนต์ และสร้างโปรเจกต์แบบเรียลไทม์ทุกหน้าจอที่เชื่อมต่อพร้อมกัน (Server-Authoritative State + Auto-Reconnect)
- **ClickUp-Style Kanban Board**: ลากวางการ์ดข้ามคอลัมน์ (`รอดำเนินการ`, `กำลังทำ`, `รอตรวจสอบ`, `เสร็จสิ้น`) และเรียงลำดับความสำคัญภายในคอลัมน์ได้ลื่นไหล พร้อมปุ่มย้ายสถานะด่วนสำหรับมือถือและคีย์บอร์ด
- **Executive Summary Dashboard**: แดชบอร์ดสรุปผลงานอัตโนมัติ (อัตราความสำเร็จ, กราฟแยกตามสถานะและระดับความสำคัญ, ภาระงานรายบุคคล, และประวัติกิจกรรมล่าสุดแบบเรียลไทม์)
- **List View & Task Detail Modal**: มุมมองตารางรายการแบบแบ่งกลุ่ม พร้อมหน้าต่างแก้ไขรายละเอียดงาน งานย่อย (Subtasks) และระบบคอมเมนต์
- **Full GitHub Integration**:
  - ดึงข้อมูล Repository, Issues และ Pull Requests จาก GitHub สาธารณะได้ทันทีโดยไม่ต้องใช้คีย์
  - นำเข้า GitHub Issues เข้ามาเป็น Task บนบอร์ดคัมบังได้ในคลิกเดียว
  - เชื่อมต่อ GitHub OAuth หรือ Personal Access Token (เก็บเฉพาะในหน่วยความจำเซิร์ฟเวอร์) เพื่อเข้าถึง Private Repo และสร้าง Issue บน GitHub จากการ์ดงานได้โดยตรง
  - ส่งออกบอร์ดงานเป็นไฟล์ `TASKS.md` (GitHub-Flavored Markdown) หรือ `.json` สำหรับ Commit ขึ้น GitHub ได้ทันที

## การติดตั้งและใช้งาน (Local & Production)

```bash
# 1. ติดตั้งแพ็กเกจ
npm install

# 2. คัดลอกไฟล์ตั้งค่า environment (ไม่บังคับ หากใช้เฉพาะ Public Repo)
cp .env.example .env

# 3. รันโหมดพัฒนา (Express + Vite + WebSocket ที่พอร์ต 3000)
npm run dev

# 4. Build และรันโหมด Production
npm run build
npm start
```

## การตั้งค่า GitHub OAuth (ไม่บังคับ)

1. ไปที่ [GitHub Developer Settings](https://github.com/settings/developers) และสร้าง OAuth App ใหม่
2. ตั้งค่า **Authorization callback URL** เป็น `<YOUR_APP_URL>/auth/callback`
3. เพิ่มค่า `GITHUB_CLIENT_ID` และ `GITHUB_CLIENT_SECRET` ลงใน Environment Variables ของระบบ (เช่น `.env` หรือ AI Studio Secrets)

## โครงสร้างโปรเจกต์

- `server.ts` — Express API Server, WebSocket Broadcast Engine, Persistent Store (`data/workspace.json`) และ GitHub REST/OAuth Proxy
- `src/types.ts` — TypeScript Interfaces กลางสำหรับ Workspace, WebSocket Events และ GitHub
- `src/hooks/useWorkspaceSocket.ts` — Custom Hook จัดการการเชื่อมต่อ WebSocket, Optimistic UI และ Reconnection
- `src/components/` — คอมโพเนนต์ UI (Dashboard, KanbanBoard, ListView, TaskDetailModal, GitHubIntegrationView, Sidebar, TopBar)

## License

MIT License — สามารถนำไปปรับแก้ ใช้งานส่วนตัว ใช้งานในทีม หรือ Push ขึ้น GitHub ได้อย่างอิสระ
