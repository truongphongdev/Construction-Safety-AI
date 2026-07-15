# HIT Product – Frontend

Dự án Frontend được xây dựng với **React 19 + TypeScript + Vite**.

---

## 🚀 Cài đặt & Chạy dự án

```bash
# Cài dependencies
npm install

# Chạy môi trường development
npm run dev

# Build production
npm run build

# Kiểm tra lint
npm run lint
```

---

## 📁 Cấu trúc thư mục

```
src/
├── assets/             # Tài nguyên tĩnh
│   ├── fonts/          # Font chữ (.ttf, .woff2, ...)
│   ├── icons/          # Icon SVG
│   └── images/         # Hình ảnh
│
├── components/         # UI Components dùng chung toàn app
├── constants/          # Hằng số, config, enum
├── hooks/              # Custom React Hooks
├── layouts/            # Layout bọc ngoài các trang
├── pages/              # Các trang tương ứng với route
├── services/           # Gọi API (axios, fetch)
├── store/              # Quản lý global state (Zustand / Redux)
├── types/              # TypeScript interfaces & types
└── utils/              # Hàm tiện ích dùng chung
```

---

## 📂 Hướng dẫn từng thư mục

### `components/`
Chứa các UI component **tái sử dụng được**, không phụ thuộc vào business logic cụ thể.

**Cấu trúc một component:**
```
components/
└── Button/
    ├── Button.tsx        # Component chính
    ├── Button.module.css # Style riêng (nếu có)
    └── index.ts          # Re-export
```

**Quy tắc:**
- Mỗi component nằm trong thư mục riêng cùng tên.
- File component đặt tên theo **PascalCase**: `Button.tsx`, `InputField.tsx`.
- Export qua `index.ts` của thư mục cha để import gọn.

```ts
// components/Button/index.ts
export { default } from './Button';

// components/index.ts
export { default as Button } from './Button';
```

---

### `pages/`
Mỗi trang tương ứng với **một route** trong ứng dụng.

**Cấu trúc:**
```
pages/
└── Home/
    ├── HomePage.tsx
    └── index.ts
```

**Quy tắc:**
- Tên thư mục và file theo **PascalCase**.
- Page chỉ chứa layout + kết nối logic (hook, store). Không viết UI chi tiết ở đây — tách ra `components/`.
- Đặt tên file rõ ràng: `HomePage.tsx`, `LoginPage.tsx`, `ProductDetailPage.tsx`.

---

### `layouts/`
Chứa các layout bọc ngoài (header, sidebar, footer).

```
layouts/
├── MainLayout/
│   ├── MainLayout.tsx
│   └── index.ts
└── AuthLayout/
    ├── AuthLayout.tsx
    └── index.ts
```

**Ví dụ dùng trong router:**
```tsx
<Route element={<MainLayout />}>
  <Route path="/" element={<HomePage />} />
</Route>
```

---

### `hooks/`
Chứa các **custom hook** tái sử dụng được.

**Quy tắc:**
- Tên hook bắt đầu bằng `use`: `useAuth.ts`, `useDebounce.ts`, `usePagination.ts`.
- Một hook một file.

```ts
// hooks/useDebounce.ts
import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
```

---

### `services/`
Chứa toàn bộ logic **gọi API**. Tách biệt hoàn toàn khỏi component.

**Cấu trúc gợi ý:**
```
services/
├── api.ts          # Axios instance, interceptors
├── authService.ts
├── userService.ts
└── index.ts
```

**Ví dụ `api.ts`:**
```ts
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 10000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
```

**Ví dụ `userService.ts`:**
```ts
import api from './api';
import type { User } from '@/types';

export const getUsers = () => api.get<User[]>('/users');
export const getUserById = (id: number) => api.get<User>(`/users/${id}`);
```

---

### `store/`
Quản lý **global state**. Ưu tiên dùng **Zustand** cho dự án vừa và nhỏ.

```ts
// store/authStore.ts
import { create } from 'zustand';

interface AuthState {
  token: string | null;
  setToken: (token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  setToken: (token) => set({ token }),
  logout: () => set({ token: null }),
}));
```

---

### `types/`
Chứa các **TypeScript interface và type** dùng chung.

**Quy tắc:**
- Nhóm theo domain: `user.ts`, `product.ts`, `api.ts`.
- Dùng `interface` cho object shape, `type` cho union/intersection.

```ts
// types/user.ts
export interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'user';
}

// types/api.ts
export interface ApiResponse<T> {
  data: T;
  message: string;
  success: boolean;
}
```

---

### `constants/`
Chứa các hằng số, config tĩnh của ứng dụng.

```ts
// constants/routes.ts
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  PROFILE: '/profile',
} as const;

// constants/config.ts
export const PAGE_SIZE = 10;
export const DATE_FORMAT = 'DD/MM/YYYY';
```

---

### `utils/`
Các **hàm thuần (pure functions)** dùng chung, không phụ thuộc React.

```ts
// utils/formatters.ts
export const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);

export const formatDate = (date: string | Date): string =>
  new Intl.DateTimeFormat('vi-VN').format(new Date(date));
```

---

## 🛣️ Path Alias

Dự án đã cấu hình alias `@` trỏ vào `src/`. Luôn dùng alias thay vì đường dẫn tương đối.

```ts
// ❌ Không dùng
import Button from '../../../components/Button';

// ✅ Dùng cái này
import Button from '@/components/Button';
import { useAuthStore } from '@/store';
import type { User } from '@/types';
```

---

## ✍️ Quy ước đặt tên

| Đối tượng              | Quy ước           | Ví dụ                        |
|------------------------|-------------------|------------------------------|
| Component / Page       | PascalCase        | `UserCard.tsx`, `HomePage.tsx` |
| Custom Hook            | camelCase + `use` | `useAuth.ts`, `useCart.ts`   |
| Service / Util / Store | camelCase         | `authService.ts`, `authStore.ts` |
| Constants              | UPPER_SNAKE_CASE  | `PAGE_SIZE`, `API_URL`       |
| Type / Interface       | PascalCase        | `User`, `ApiResponse<T>`     |
| CSS Module             | camelCase         | `button.module.css`          |

---

## 🔀 Quy trình Git

```bash
# Tạo branch từ main/develop
git checkout -b feature/ten-tinh-nang

# Commit theo chuẩn Conventional Commits
git commit -m "feat: thêm trang đăng nhập"
git commit -m "fix: sửa lỗi validate form"
git commit -m "refactor: tách UserCard thành component"

# Push và tạo Pull Request
git push origin feature/ten-tinh-nang
```

**Tiền tố commit:**
- `feat` – tính năng mới
- `fix` – sửa lỗi
- `refactor` – tái cấu trúc code
- `style` – chỉnh sửa CSS/style
- `chore` – config, dependency
- `docs` – cập nhật tài liệu

---

## ⚙️ Biến môi trường

Tạo file `.env` tại root (không commit lên git):

```env
VITE_API_BASE_URL=https://api.example.com
VITE_APP_NAME=HIT Product
```

Truy cập trong code:
```ts
const baseUrl = import.meta.env.VITE_API_BASE_URL;
```

> Biến môi trường trong Vite **bắt buộc** phải có tiền tố `VITE_` mới được expose ra client.

---

## 🧰 Tech Stack

| Thư viện        | Mục đích                  |
|-----------------|---------------------------|
| React 19        | UI Framework              |
| TypeScript      | Type Safety               |
| Vite            | Build Tool / Dev Server   |
| Oxlint          | Linting                   |
