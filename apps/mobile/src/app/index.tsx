import { Text, View } from 'react-native';

// Màn giữ chỗ của T1 — chỉ để cổng typecheck/bundle có thứ thật mà nhai. Cây
// route thật (5 tab + auth + tours + bookings) dựng ở T6.
export default function IndexScreen() {
  return (
    <View>
      <Text>Nexora Travel</Text>
    </View>
  );
}
