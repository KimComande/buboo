import unittest

from import_momangde_xlsx import (
    build_db_from_rows,
    normalize_phone,
    parse_seat_label,
)


class MomangdeImportTest(unittest.TestCase):
    def test_normalizers(self):
        self.assertEqual(normalize_phone("010-1234-5678"), "01012345678")
        self.assertEqual(parse_seat_label("남자 12"), ("male", 12))
        self.assertEqual(parse_seat_label("여자 3번"), ("female", 3))
        self.assertEqual(parse_seat_label("없음"), (None, None))

    def test_build_db_from_rows_creates_members_history_stats_and_matches(self):
        survey_rows = [
            [
                "응답일시",
                "참여자",
                "본인의 이름을 적어주세요.(*)",
                "본인의 연락처를 작성해주세요.(*)",
                "참여하신 플랫폼 닉네임을 적어주세요.(*)",
                "본인 번호를 선택해주세요.(*)",
                "오늘의 1순위 이성는 누구였나요? (남자 __번)(*)",
                "오늘의 2순위 이성은 누구였나요? (남자 __번)(*)",
                "점수",
                "득표 수",
                "랭킹",
                "년도",
                "직업",
                "키",
                "장점",
                "MBTI",
                "이성에게 바라는 점",
                "",
                "",
                "(선택) 익명의 편지를 작성해주세요.",
            ],
            [
                "2026-01-03 17:30:00",
                "1",
                "김민수",
                "010-1111-1111",
                "도윤",
                "남자 1",
                "여자 1",
                "없음",
                "2",
                "1",
                "1",
                "1990",
                "개발자",
                "178",
                "성실함",
                "ENTJ",
                "배려심",
                "",
                "토요일",
                "반가웠어요",
            ],
            [
                "2026-01-03 17:31:00",
                "2",
                "김민수",
                "01011111111",
                "준호",
                "남자 1",
                "여자 1",
                "없음",
                "2",
                "1",
                "1",
                "1990",
                "개발자",
                "178",
                "성실함",
                "ENTJ",
                "배려심",
            ],
            [
                "2026-01-03 17:32:00",
                "3",
                "이서연",
                "010-2222-2222",
                "서연",
                "여자 1",
                "남자 1",
                "없음",
                "2",
                "1",
                "1",
                "1992",
                "기획자",
                "165",
                "밝음",
                "ISFJ",
                "진정성",
            ],
        ]
        profile_rows = [
            ["닉네임", "남자 번호", "전화번호", "년도", "직업", "키", "장점", "MBTI", "이성에게 바라는 점"],
            ["도윤", "남자 1", "01011111111", "1990", "개발자", "178", "성실함", "ENTJ", "배려심"],
            ["전화없음", "여자 2", "", "1994", "교사", "160", "차분함", "INFP", "대화"],
        ]

        db, report = build_db_from_rows(survey_rows, profile_rows)

        self.assertEqual(len(db["events"]), 1)
        self.assertEqual(db["events"][0]["status"], "released")
        self.assertEqual(len(db["members"]), 3)
        male = next(member for member in db["members"] if member["phone"] == "01011111111")
        self.assertEqual(male["latestNickname"], "준호")
        self.assertIn("도윤", male["nicknameAliases"])
        self.assertIn("준호", male["nicknameAliases"])
        self.assertEqual(len(db["surveySubmissions"]), 2)
        self.assertEqual(len(db["matchResults"]), 1)
        self.assertEqual(len(db["voteStats"]), 2)
        self.assertEqual(report["surveyRowsImported"], 2)
        self.assertEqual(report["profileRowsImported"], 1)


if __name__ == "__main__":
    unittest.main()
