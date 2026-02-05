# ERP Satış Modülü - Teknik Spesifikasyon Dokümanı

## Bölüm 1: Backend RESTful API Tasarımı

Bu bölüm, Node.js (Express/NestJS) tabanlı backend mimarisi için endpoint taslaklarını içerir. Tüm endpointler `Bearer Token (JWT)` ile korunmaktadır.

### 1. Genel Satış Yönetimi (Все продажи / Закрытые продажи)

bu grup, tamamlanmış satışların listelenmesi, detaylandırılması ve yeni satış oluşturulması içindir.

#### `GET /api/v1/sales`
*   **Açıklama:** Filtrelere göre tüm satış geçmişini listeler (Pagination destekli).
*   **Yetki:** Admin, Manager, Cashier (Sadece kendi satışları).
*   **Query Parametreleri:**
    *   `page`: Sayfa numarası (default: 1)
    *   `limit`: Sayfa başına kayıt (default: 20)
    *   `startDate`: Başlangıç tarihi (ISO)
    *   `endDate`: Bitiş tarihi (ISO)
    *   `status`: 'completed', 'returned', 'cancelled'
    *   `cashierId`: Belirli bir kasiyeri filtrele
    *   `minAmount`, `maxAmount`: Tutar aralığı
*   **Response (200 OK):**
    ```json
    {
      "data": [
        {
          "id": "sale_12345",
          "invoiceNumber": "INV-2023-001",
          "totalAmountUZS": 150000,
          "totalAmountUSD": 0,
          "status": "completed",
          "createdAt": "2023-10-25T14:30:00Z",
          "cashier": { "id": "u1", "name": "Ali" }
        }
      ],
      "meta": { "total": 150, "page": 1, "lastPage": 8 }
    }
    ```

#### `POST /api/v1/sales`
*   **Açıklama:** Yeni bir satışı tamamlar ve stoktan düşer.
*   **Yetki:** Admin, Manager, Cashier.
*   **Request Body:**
    ```json
    {
      "items": [
        { "productId": "p1", "quantity": 2, "price": 100, "currency": "USD" }
      ],
      "payments": [
        { "method": "cash", "amount": 100, "currency": "USD" },
        { "method": "card", "amount": 50000, "currency": "UZS" }
      ],
      "customerId": "c1" // Opsiyonel
    }
    ```
*   **Hata Senaryoları:**
    *   `400 Bad Request`: Yetersiz stok veya ödeme tutarı uyuşmazlığı.

#### `POST /api/v1/sales/:id/return`
*   **Açıklama:** Bir satış için tam veya kısmi iade işlemi başlatır.
*   **Yetki:** Admin, Manager.
*   **Request Body:**
    ```json
    {
      "items": [ { "productId": "p1", "quantity": 1, "returnReason": "defective" } ],
      "refundMethod": "cash"
    }
    ```

---

### 2. Kasa Vardiyaları (Кассовые смены)

#### `POST /api/v1/shifts/start`
*   **Açıklama:** Yeni bir kasa vardiyası başlatır.
*   **Yetki:** Cashier, Manager.
*   **Request Body:**
    ```json
    {
      "openingBalanceUZS": 100000,
      "openingBalanceUSD": 50,
      "terminalId": "POS-01"
    }
    ```

#### `POST /api/v1/shifts/end` (Z-Raporu)
*   **Açıklama:** Aktif vardiyayı kapatır ve Z-Raporu oluşturur.
*   **Yetki:** Cashier, Manager.
*   **Request Body:**
    ```json
    {
      "closingBalanceActualUZS": 550000,
      "closingBalanceActualUSD": 120
    }
    ```
*   **Mantık:** Sistem teorik bakiye ile girilen (actual) bakiyeyi karşılaştırır ve `variance` (sapma) hesaplar.

#### `GET /api/v1/shifts/current`
*   **Açıklama:** Kullanıcının veya terminalin aktif vardiya bilgisini döner.

---

### 3. Açık ve Ertelenmiş Satışlar (Открытые ve Отложенные продажи)

#### `POST /api/v1/sales/park`
*   **Açıklama:** Mevcut sepeti "Beklemeye" (Park) alır.
*   **Yetki:** Cashier.
*   **Request Body:**
    ```json
    {
      "items": [...],
      "note": "Müşteri para çekmeye gitti",
      "customerName": "Ahmet Bey"
    }
    ```

#### `GET /api/v1/sales/live-monitor`
*   **Açıklama:** Tüm terminallerdeki açık sepetleri anlık izlemek için (WebSocket alternatifi polling).
*   **Yetki:** Manager, Admin.

---

### 4. Silinen Satışlar (Удаленные продажи)

#### `DELETE /api/v1/sales/:id`
*   **Açıklama:** Bir satışı iptal eder/siler (Soft Delete).
*   **Yetki:** Admin, Manager (Onay gerekebilir).
*   **Request Body:**
    ```json
    {
      "reason": "Wrong price entry",
      "managerAuthToken": "..." // Müdürü onayı gerekiyorsa
    }
    ```

#### `GET /api/v1/audit/deleted-sales`
*   **Açıklama:** Silinen satışların loglarını getirir.

---
---

## Bölüm 2: Veritabanı Şema Tasarımı (MSSQL & MongoDB)

### 1. Sales (Satışlar)

| Alan Adı | MongoDB Tipi | MSSQL Tipi | Açıklama |
| :--- | :--- | :--- | :--- |
| `_id` / `id` | `ObjectId` | `BIGINT PK` | Benzersiz kayıt ID |
| `invoiceNumber` | `String` | `NVARCHAR(50)` | Fatura/Fiş No (Unique Index) |
| `branchId` | `ObjectId` | `INT FK` | Şube Referansı |
| `cashierId` | `ObjectId` | `INT FK` | İşlemi yapan personel |
| `customerId` | `ObjectId` | `INT FK` | Müşteri (Nullable) |
| `status` | `String` | `VARCHAR(20)` | `completed`, `returned`, `cancelled` |
| `totalAmountUZS`| `Decimal128` | `DECIMAL(18,2)` | Toplam tutar (UZS) |
| `totalAmountUSD`| `Decimal128` | `DECIMAL(18,2)` | Toplam tutar (USD) |
| `payments` | `Array<Object>`| `JSON` veya `SalePayments` Table | Ödeme detayları |
| `items` | `Array<Object>`| `JSON` veya `SaleItems` Table | Satılan ürünler (Snapshot) |
| `isDeleted` | `Boolean` | `BIT` | Soft delete bayrağı |
| `createdAt` | `Date` | `DATETIME2` | Oluşturulma zamanı |

*   **MongoDB Şema Örneği:**
    ```json
    {
      "invoiceNumber": "INV-001",
      "items": [
        { "productId": "p1", "name": "Laptop", "price": 1000, "qty": 1, "currency": "USD" }
      ],
      "payments": [
        { "method": "cash", "amount": 1000, "currency": "USD", "rate": 1 }
      ]
    }
    ```

### 2. Shifts (Vardiyalar)

| Alan Adı | MongoDB Tipi | MSSQL Tipi | Açıklama |
| :--- | :--- | :--- | :--- |
| `cashierId` | `ObjectId` | `INT FK` | Kasiyer |
| `terminalId` | `String` | `VARCHAR(50)` | POS Cihaz/Terminal ID |
| `startTime` | `Date` | `DATETIME2` | Başlangıç |
| `endTime` | `Date` | `DATETIME2` | Bitiş (Null ise aktif) |
| `openingBalUZS` | `Decimal128` | `DECIMAL(18,2)` | Açılış Kasa (UZS) |
| `openingBalUSD` | `Decimal128` | `DECIMAL(18,2)` | Açılış Kasa (USD) |
| `salesCashUZS` | `Decimal128` | `DECIMAL(18,2)` | Nakit Satış Toplamı (System) |
| `salesCashUSD` | `Decimal128` | `DECIMAL(18,2)` | Nakit Satış Toplamı (System) |
| `closingBalActualUZS`| `Decimal128`| `DECIMAL(18,2)` | Sayılan Kasa (Z-Raporu) |
| `closingBalActualUSD`| `Decimal128`| `DECIMAL(18,2)` | Sayılan Kasa (Z-Raporu) |

### 3. AuditLogs (Denetim Kayıtları)

| Alan Adı | MongoDB Tipi | MSSQL Tipi | Açıklama |
| :--- | :--- | :--- | :--- |
| `action` | `String` | `VARCHAR(50)` | `DELETE_SALE`, `UPDATE_PRICE` |
| `entityId` | `String` | `VARCHAR(50)` | Etkilenen kayıt ID (Sale ID) |
| `performedBy` | `ObjectId` | `INT FK` | İşlemi yapan kullanıcı |
| `details` | `Object` | `NVARCHAR(MAX)` / `JSON` | Esk/Yeni değerler, İptal nedeni |
| `timestamp` | `Date` | `DATETIME2` | İşlem zamanı |

### 4. DelayedSales (Bekleyen Satışlar)

Genellikle Redis gibi bir Key-Value store'da tutulması performans için önerilir, ancak kalıcı DB'de tutulacaksa:

*   **MongoDB:** `sales` collection içinde `status: 'delayed'` veya `status: 'parked'` olarak tutulabilir.
*   **TTL Index:** `updatedAt` alanına TTL (Time-To-Live) index eklenerek örneğin 24 saat sonra otomatik silinmesi sağlanabilir.

## Performans ve İndeksleme Önerileri

1.  **Compound Index (Sales):** `branchId` + `createdAt` (Şube bazlı tarihsel raporlama için çok hızlı erişim).
2.  **Text Index:** `invoiceNumber` ve `customerName` üzerinde (Hızlı arama için).
3.  **Sharding (MongoDB):** Çok büyük veri setlerinde `branchId` veya aylık `createdAt` bazlı sharding stratejisi.
