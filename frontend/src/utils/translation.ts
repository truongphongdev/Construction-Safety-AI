/**
 * Ánh xạ nhãn phát hiện lỗi của YOLOv8 sang Tiếng Việt hiển thị cho người dùng.
 */
export const mapViolationType = (type: string): string => {
  if (!type) return 'Vi phạm an toàn';
  const t = type.toLowerCase().trim();
  if (t === 'no_helmet' || t === 'helmet_off' || t === 'helmet') return 'Không đội mũ bảo hộ';
  if (t === 'no_vest' || t === 'vest_off' || t === 'vest') return 'Không mặc áo bảo hộ';
  if (t === 'fall' || t === 'falling') return 'Phát hiện té ngã';
  if (t === 'zone_intrusion' || t === 'intrusion' || t.includes('zone')) return 'Xâm nhập vùng cấm';
  if (t === 'no_shield' || t === 'shield_off') return 'Không đeo mặt nạ bảo hộ';
  if (t === 'no_goggles' || t === 'goggles_off') return 'Không đeo kính bảo hộ';
  if (t === 'no_gloves' || t === 'gloves_off') return 'Không đeo găng tay bảo hộ';
  return type;
};
