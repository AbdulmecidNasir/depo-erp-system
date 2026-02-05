# Satış Yönetim Sistemi API Dokümantasyonu

Bu belge, yeni uygulanan **Sipariş -> Sevkiyat -> Ödeme** akışının nasıl kullanılacağını açıklar.

## 1. Mantıksal Akış

1.  **Sipariş (Order)**: Müşteri bir talep oluşturur. Stok düşmez, sadece niyet beyanıdır.
2.  **Sevkiyat (Shipment)**: Depodan mal çıkar. Stok bu aşamada düşer. Konsinye/Yoldaki mal durumuna geçer.
3.  **Ödeme (Payment)**: Müşteriden ödeme alınır. Borç kapanır. Muhasebesel **Satış (Sale)** kaydı oluşur.

## 2. API Uç Noktaları

### Adım 1: Sipariş Oluşturma
Bu adımda stok düşmeyecek, sadece rezervasyon kontrolü yapılacak.

-   **Endpoint**: `POST /api/orders`
-   **Body**:
    ```json
    {
      "items": [
        { "product": "PRODUCT_ID", "quantity": 10 }
      ],
      "customerId": "USER_ID",
      "customerModel": "User", // veya 'Debitor'
      "notes": "Test siparişi"
    }
    ```
-   **Sonuç**: Sipariş `confirmed` statüsünde oluşur.

### Adım 2: Sevkiyat (Mal Çıkışı)
Bu adımda stok fiziksel olarak düşer.

-   **Endpoint**: `POST /api/shipments`
-   **Body**:
    ```json
    {
      "orderId": "ORDER_ID", // Adım 1'den dönen ID
      "items": [
        { "product": "PRODUCT_ID", "quantity": 10 }
      ],
      "trackingNumber": "TRACK123",
      "notes": "Kamyon plakası 34ABC123"
    }
    ```
-   **Sonuç**:
    -   `StockMovement` (type: out) kayıtları oluşur.
    -   `Product.stock` azalır.
    -   Siparişin durumu `shipped` olarak güncellenir.

### Adım 3: Ödeme (Kapanış)
Bu adımda finansal işlem gerçekleşir ve satış resmileşir.

-   **Endpoint**: `POST /api/payments`
-   **Body**:
    ```json
    {
      "orderId": "ORDER_ID",
      "amount": 1500.00,
      "method": "bank_transfer", // cash, card, other
      "notes": "Havale ile ödeme"
    }
    ```
-   **Sonuç**:
    -   Eğer ödeme tutarı sipariş toplamını karşılıyorsa, Sipariş `completed` olur.
    -   `Sale` koleksiyonunda yeni bir satış kaydı oluşturulur (Muhasebe için).
    -   Payment kaydı oluşturulur.

## 3. Sorgulama

-   **Siparişin Sevkiyatlarını Gör**: `GET /api/shipments/order/:orderId`
-   **Siparişin Ödemelerini Gör**: `GET /api/payments/order/:orderId`
