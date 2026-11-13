# kh-forms — 경향신문 설문·신청 페이지

화면은 GitHub Pages, 데이터는 구글시트(Apps Script)로 받는 구조입니다.

```
kh-forms/
├─ finance-class/index.html   찾아가는 금융교실 신청
├─ (다음 설문)/index.html
└─ apps-script/Code.gs        구글시트 접수 창구 (GitHub에는 참고용)
```

## 1. 구글시트 연결 (처음 한 번)

1. 새 구글시트 만들기 (예: `경향 설문 접수`)
2. 확장 프로그램 → Apps Script → `Code.gs` 내용 전체 붙여넣기 → 저장
3. 함수 목록에서 `testSetup` 실행 → 권한 승인 (시트에 `finance-class` 탭이 생기면 성공)
4. 배포 → 새 배포 → 유형: 웹 앱 / 실행: 나 / 액세스: **모든 사용자** → 배포
5. 나온 `https://script.google.com/macros/s/…/exec` 주소 복사

## 2. 페이지 연결

`finance-class/index.html` 아래쪽 `CONFIG.SCRIPT_URL`에 위 주소를 붙여넣기.
마감일(`DEADLINE`), 신청 가능 기간(`LEAD_DAYS`), 시간 선택지(`TIMES`)도 여기서 바꿉니다.

## 3. GitHub Pages

저장소 Settings → Pages → Branch: `main` / `(root)` → 저장
→ `https://vmaker1.github.io/kh-forms/finance-class/`

## 새 설문 추가할 때

1. `Code.gs`의 `FORMS`에 설문 한 줄 추가 → **배포 관리 → 기존 배포 수정 → 새 버전**으로 재배포 (주소 그대로 유지)
2. 새 폴더에 페이지 만들고 `FORM_ID`를 같은 이름으로

## 주의

- Apps Script 코드를 고친 뒤에는 꼭 "새 버전"으로 재배포해야 반영됩니다. "새 배포"를 누르면 주소가 바뀝니다.
- 시트의 초록색 열(진행상태·확정일자·배정강사·신복위전달·담당메모)은 담당자가 직접 관리하는 칸입니다.
