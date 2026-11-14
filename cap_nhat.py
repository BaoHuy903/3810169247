#!/usr/bin/env python3
"""Chạy trong repo gốc: python cap_nhat.py"""
from pathlib import Path
import json
root = Path(__file__).resolve().parent
html = root/'index.html'
jpath = root/'project.json'
if not html.exists() or not jpath.exists():
    raise SystemExit('Cần giải nén bản vá vào repo 3810169247 trước khi chạy.')
s = html.read_text(encoding='utf-8')
s = s.replace('<html lang="en">', '<html lang="vi">').replace('<title>Koi Pond Wallpaper</title>', '<title>Hồ cá Koi - Hình nền động</title>')
if 'photo-frames.css' not in s:
    s = s.replace('<link rel="stylesheet" href="style.css">','<link rel="stylesheet" href="style.css">\n<link rel="stylesheet" href="photo-frames.css">')
if 'photo-frames.js' not in s:
    s = s.replace('</body>', '    <script src="photo-frames.js"></script>\n</body>')
html.write_text(s,encoding='utf-8')
p = json.loads(jpath.read_text(encoding='utf-8'))
p['title']='Hồ cá Koi - Khung ảnh kỷ niệm'
p['description']='Hình nền hồ cá Koi động bằng tiếng Việt. Có thời tiết, bốn mùa, đồng hồ, ba khung ảnh có thể tải ảnh riêng, treo và kéo thả. Hỗ trợ chế độ không giới hạn FPS (tùy thuộc Wallpaper Engine và màn hình).'
vi={'ui_auto_weather':'Tự động theo thời tiết thực tế','ui_clock_edit':'Điều chỉnh vị trí đồng hồ','ui_day_cycle':'Ánh sáng theo giờ thực tế','ui_enable_caustics':'Hiệu ứng ánh sáng trên nước','ui_enable_feeding':'Nhấn chuột để cho cá ăn','ui_fish_count':'Số lượng cá Koi','ui_fish_size':'Kích thước cá','ui_fish_speed':'Tốc độ bơi của cá','ui_fps':'Giới hạn FPS (0 = Không giới hạn)','ui_idle_events':'Lá và hoa rơi','ui_night_dim':'Độ tối ban đêm','ui_ripple_strength':'Cường độ gợn sóng','ui_schemecolor':'Màu chủ đề','ui_season':'Mùa','ui_season_auto':'Tự động','ui_season_autumn':'Mùa thu','ui_season_fx':'Mức hiệu ứng mùa','ui_season_spring':'Mùa xuân','ui_season_summer':'Mùa hè','ui_season_winter':'Mùa đông','ui_show_clock':'Hiển thị giờ và thời tiết','ui_shy_fish':'Cá tránh con trỏ chuột','ui_water_hue':'Màu nước','ui_weather':'Thời tiết','ui_weather_clear':'Trời nắng','ui_weather_cloudy':'Nhiều mây','ui_weather_fog':'Có sương mù','ui_weather_heavy_rain':'Mưa lớn','ui_weather_heavy_snow':'Tuyết dày','ui_weather_light_rain':'Mưa nhỏ','ui_weather_light_snow':'Tuyết nhẹ','ui_weather_overcast':'Trời âm u','ui_weather_thunderstorm':'Mưa dông'}
p['general']['localization']['vi-vn'] = vi
props = p['general']['properties']
mapping={'autoWeather':'Tự động theo thời tiết thực tế','clockEdit':'Điều chỉnh vị trí đồng hồ','clockShow':'Hiển thị giờ và thời tiết','dayCycle':'Ánh sáng theo thời gian thực','enableCaustics':'Hiệu ứng ánh sáng trên nước','enableFeeding':'Nhấn để cho cá ăn','fishCount':'Số lượng cá Koi','fishSize':'Kích thước cá','fishSpeed':'Tốc độ bơi','fps':'Giới hạn FPS (0 = Không giới hạn)','idleEvents':'Lá và hoa rơi','nightDim':'Độ tối ban đêm','rippleStrength':'Độ mạnh gợn sóng','schemecolor':'Màu chủ đề','season':'Mùa','seasonFx':'Mức độ hiệu ứng theo mùa','shyFish':'Cá tránh chuột','waterHue':'Màu nước','weather':'Thời tiết','englishMode':'Ngôn ngữ'}
for key, title in mapping.items():
    if key in props: props[key]['text']=title
if 'englishMode' in props:
    props['englishMode']['options']=[{'label':'Tiếng Việt','value':0}]
    props['englishMode']['value']=0
for key,labels in [('season',['Tự động','Mùa xuân','Mùa hè','Mùa thu','Mùa đông']),('weather',['Trời nắng','Nhiều mây','Trời âm u','Có sương mù','Mưa nhỏ','Mưa lớn','Mưa dông','Tuyết nhẹ','Tuyết dày'])]:
    if key in props:
        for item,label in zip(props[key]['options'],labels): item['label']=label
if 'fps' in props: props['fps'].update({'min':0,'max':240,'value':0})
jpath.write_text(json.dumps(p,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
f=root/'src/platform/properties.js'
if f.exists():
    f.write_text(f.read_text(encoding='utf-8').replace('fps: [0, 144]','fps: [0, 240]'),encoding='utf-8')
clock=root/'src/features/clock.js'
if clock.exists():
    src=clock.read_text(encoding='utf-8')
    src=src.replace("(d.getMonth() + 1) + '月' + d.getDate() + '日  星期' + ['日', '一', '二', '三', '四', '五', '六'][d.getDay()]", "(d.getDay() === 0 ? 'Chủ nhật' : 'Thứ ' + (d.getDay() + 1)) + ', ' + d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear()")
    src=src.replace("'拖动时间组件'","'Kéo đồng hồ'").replace("'保存'","'Lưu'")
    clock.write_text(src,encoding='utf-8')
print('Đã Việt hóa project.json, index.html, đồng hồ và FPS.')
print('Tiếp theo: node tools/build-bundle.mjs')
