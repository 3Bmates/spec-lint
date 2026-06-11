# 测试规格 — fixture

本文件用于解析器测试。

## 接口: UserService
- **方法**: `getUser(id: string): Promise<User>`
- **方法**: `createUser(data: CreateUserDTO): Promise<User>`

## 类型: User
```typescript
interface User {
  id: string;
  name: string;
  email: string;
}
```

## 类型: CreateUserDTO
```typescript
type CreateUserDTO = {
  name: string;
  email: string;
};
```

## 函数: formatDate
- **签名**: `formatDate(date: Date, format: string): string`

## 函数: validateEmail
- **签名**: `validateEmail(email: string): boolean`
