# Phân Tích Logic Contracts ArcShield

## Tổng Quan
ArcShield là một dApp bảo vệ FX non-custodial giúp người dùng bảo vệ giá trị stablecoin khỏi rủi ro tiền tệ mà không cần trading hay derivatives.

## Các Vấn Đề Logic Phát Hiện

### 🔴 VẤN ĐỀ NGHIÊM TRỌNG 1: Health Factor Không Sử Dụng Exchange Rate

**File**: `contracts/src/HedgePosition.sol` (dòng 154-163)

**Vấn đề**:
```solidity
function getHealthFactor() public view returns (uint256) {
    uint256 currentDebt = getCurrentDebt();
    if (currentDebt == 0) return type(uint256).max;
    
    uint256 collateralFactor = 8000;
    
    uint256 exchangeRate = getSafeExchangeRate(); // ⚠️ Lấy rate nhưng KHÔNG dùng!
    
    return (collateral * collateralFactor) / currentDebt;
}
```

**Phân tích**:
- Hàm lấy `exchangeRate` nhưng không sử dụng trong công thức
- Health factor nên phản ánh rủi ro khi currency depreciate
- Khi currency giảm giá, position risk tăng nhưng health factor không phản ánh điều này

**Đề xuất sửa**:
Health factor nên tính toán dựa trên:
- Collateral value (USDC)
- Current debt (với interest)
- Exchange rate change so với entry rate
- Potential payout từ protection

### 🟡 VẤN ĐỀ 2: Borrowing Mechanism Không Rõ Ràng

**File**: `contracts/src/ArcShieldRouter.sol` (dòng 129-169)

**Vấn đề**:
- Khi `activateProtection`, hệ thống tính `maxBorrow` nhưng KHÔNG thực sự rút tiền từ pool
- Chỉ track `userBorrowedAmount` và `totalBorrowedAmount`
- Gọi `fundingPool.recordBorrowedAmount(maxBorrow)` nhưng không withdraw funds

**Phân tích**:
- Đây có thể là thiết kế "virtual borrowing" - funds vẫn ở trong pool
- Nhưng điều này không rõ ràng và có thể gây nhầm lẫn
- Nếu là virtual borrowing, cần documentation rõ ràng

**Câu hỏi**:
- Funds có thực sự được "borrow" từ pool không?
- Hay đây chỉ là tracking mechanism cho exposure?

### 🟡 VẤN ĐỀ 3: Collateral Factor Hardcoded Không Phù Hợp

**File**: `contracts/src/HedgePosition.sol` (dòng 158)

**Vấn đề**:
```solidity
uint256 collateralFactor = 8000; // Hardcoded 80%
```

**Phân tích**:
- LTV limits là: Low (20%), Medium (35%), High (50%)
- Nhưng collateral factor lại là 80% - không khớp với LTV
- Collateral factor nên phản ánh mức độ bảo vệ (protection level)

**Đề xuất**:
- Collateral factor nên dựa trên `protectionLevel`
- Hoặc tính toán dựa trên LTV limit tương ứng

### 🟢 VẤN ĐỀ 4: Settlement Logic Có Thể Cải Thiện

**File**: `contracts/src/ArcShieldRouter.sol` (dòng 391-478)

**Phân tích**:
- Logic settlement có vẻ đúng: tính payout, trả debt, trả lại cho user
- Nhưng có edge case: nếu pool không đủ funds, chỉ emit event, không fail transaction
- User vẫn mất position nhưng không nhận được payout đầy đủ

**Đề xuất**:
- Cân nhắc revert nếu pool không đủ funds cho payout
- Hoặc implement partial payout mechanism

### 🟡 VẤN ĐỀ 5: Health Factor Không Phản Ánh FX Risk Đúng Cách

**Logic hiện tại**:
```
Health Factor = (Collateral × 80%) / Current Debt
```

**Vấn đề**:
- Không tính đến exchange rate change
- Khi currency depreciate, risk tăng nhưng health factor không thay đổi
- Health factor nên giảm khi currency depreciate (vì protection payout tăng nhưng debt vẫn phải trả)

**Đề xuất công thức mới**:
```
Adjusted Collateral = Collateral + Potential Payout - Debt
Health Factor = Adjusted Collateral / Debt
```

Hoặc:
```
Health Factor = (Collateral × Collateral Factor × (Entry Rate / Current Rate)) / Current Debt
```

### 🟢 VẤN ĐỀ 6: Interest Accrual Có Thể Gây Vấn Đề

**File**: `contracts/src/HedgePosition.sol` (dòng 108-128)

**Phân tích**:
- Interest rate: 500 basis points (5% per year)
- Interest được tính và cộng vào debt
- Nếu user không settle trong thời gian dài, debt tăng đáng kể

**Đề xuất**:
- Cân nhắc cap interest hoặc implement interest-free period
- Hoặc cho phép user repay interest riêng mà không cần repay principal

## Các Điểm Tích Cực

✅ **Reentrancy Protection**: Tất cả functions quan trọng đều có `nonReentrant`
✅ **Access Control**: Proper modifiers (`onlyOwner`, `onlyOwnerOrRouter`)
✅ **Oracle Fallback**: Có fallback mechanism khi oracle stale
✅ **Liquidation Logic**: Có liquidation mechanism với bonus
✅ **Debt Tracking**: Track borrowed amounts properly
✅ **Event Logging**: Comprehensive event emissions

## Khuyến Nghị Sửa Chữa Ưu Tiên

### Priority 1 (Critical):
1. **Sửa Health Factor calculation** - Sử dụng exchange rate trong công thức
2. **Clarify borrowing mechanism** - Document rõ ràng virtual vs real borrowing

### Priority 2 (Important):
3. **Dynamic collateral factor** - Dựa trên protection level
4. **Improve settlement edge cases** - Handle insufficient funds better

### Priority 3 (Nice to have):
5. **Interest cap mechanism**
6. **Better health factor formula** - Account for FX risk properly

## Kết Luận

Contracts có cấu trúc tốt với security measures đầy đủ, nhưng có một số vấn đề logic quan trọng cần sửa, đặc biệt là Health Factor calculation không phản ánh đúng FX risk.


