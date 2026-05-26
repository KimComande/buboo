import argparse
import json
import re
import shutil
import sys
import zipfile
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path
from xml.etree import ElementTree as ET


NS = {
    "m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "rel": "http://schemas.openxmlformats.org/package/2006/relationships",
}

MALE_KO = "\ub0a8\uc790"
FEMALE_KO = "\uc5ec\uc790"


def normalize_phone(value):
    return re.sub(r"\D", "", str(value or ""))


def clean_text(value, keep_zero=False):
    text = str(value or "").strip()
    if not keep_zero and text == "0":
        return ""
    return text


def parse_seat_label(value):
    text = str(value or "").strip()
    if not text or "\uc5c6\uc74c" in text:
        return None, None

    gender = None
    if MALE_KO in text:
        gender = "male"
    if FEMALE_KO in text:
        gender = "female"
    match = re.search(r"\d+", text)
    if not gender or not match:
        return None, None
    return gender, int(match.group(0))


def compact_date(date_value):
    date = date_only(date_value)
    return f"{date[2:4]}{date[5:7]}{date[8:10]}"


def date_only(value):
    text = str(value or "").strip()
    if re.match(r"^\d{4}-\d{2}-\d{2}", text):
        return text[:10]
    if re.match(r"^\d{4}/\d{1,2}/\d{1,2}", text):
        parsed = datetime.strptime(text.split()[0], "%Y/%m/%d")
        return parsed.strftime("%Y-%m-%d")
    raise ValueError(f"Unsupported date value: {value!r}")


def iso_from_excel_text(value):
    text = str(value or "").strip()
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y/%m/%d %H:%M:%S", "%Y-%m-%d", "%Y/%m/%d"):
        try:
            parsed = datetime.strptime(text, fmt)
            return parsed.isoformat(timespec="seconds") + ".000Z"
        except ValueError:
            pass
    return f"{date_only(text)}T00:00:00.000Z"


def read_xlsx(path):
    path = Path(path)
    with zipfile.ZipFile(path) as archive:
        shared_strings = []
        if "xl/sharedStrings.xml" in archive.namelist():
            root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            for item in root.findall("m:si", NS):
                shared_strings.append("".join(item.itertext()))

        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        rels = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        rel_targets = {
            rel.attrib["Id"]: rel.attrib["Target"]
            for rel in rels.findall("rel:Relationship", NS)
        }

        sheets = []
        for sheet in workbook.findall("m:sheets/m:sheet", NS):
            rel_id = sheet.attrib[f"{{{NS['r']}}}id"]
            target = rel_targets[rel_id]
            if not target.startswith("xl/"):
                target = f"xl/{target.lstrip('/')}"
            sheets.append((sheet.attrib["name"], read_sheet(archive, target, shared_strings)))
        return sheets


def read_sheet(archive, target, shared_strings):
    root = ET.fromstring(archive.read(target))
    rows = []
    for row in root.findall("m:sheetData/m:row", NS):
        values = []
        for cell in row.findall("m:c", NS):
            index = cell_index(cell.attrib.get("r", ""))
            while len(values) <= index:
                values.append("")
            values[index] = cell_value(cell, shared_strings)
        if any(str(value).strip() for value in values):
            rows.append(values)
    return rows


def cell_index(cell_ref):
    letters = "".join(char for char in cell_ref if char.isalpha())
    value = 0
    for char in letters:
        value = value * 26 + ord(char.upper()) - 64
    return max(value - 1, 0)


def cell_value(cell, shared_strings):
    cell_type = cell.attrib.get("t")
    if cell_type == "s":
        raw = text_of(cell.find("m:v", NS))
        return shared_strings[int(raw)].strip() if raw else ""
    if cell_type == "inlineStr":
        return text_of(cell.find("m:is", NS)).strip()
    return text_of(cell.find("m:v", NS)).strip()


def text_of(node):
    return "" if node is None else "".join(node.itertext())


def build_db_from_rows(survey_rows, profile_rows, include_demo_event=False):
    now = datetime.now().isoformat(timespec="seconds") + ".000Z"
    db = empty_db()
    report = {
        "surveyRowsSeen": 0,
        "surveyRowsImported": 0,
        "surveyDuplicateSeatRowsCollapsed": 0,
        "profileRowsSeen": 0,
        "profileRowsImported": 0,
        "membersCreated": 0,
        "eventsCreated": 0,
        "submissionsCreated": 0,
        "matchesCreated": 0,
        "voteStatsCreated": 0,
        "phonesWithMultipleRows": 0,
        "warnings": [],
    }

    survey_data = normalize_survey_rows(survey_rows)
    report["surveyRowsSeen"] = len(survey_data)
    phones = Counter(row["phone"] for row in survey_data if row["phone"])
    report["phonesWithMultipleRows"] = sum(1 for count in phones.values() if count > 1)

    grouped = defaultdict(list)
    for row in survey_data:
        grouped[row["eventDate"]].append(row)

    for event_date in sorted(grouped):
        event_rows = latest_rows_by_seat(grouped[event_date])
        report["surveyDuplicateSeatRowsCollapsed"] += len(grouped[event_date]) - len(event_rows)
        event = create_event(db, event_date, event_rows, now)
        report["eventsCreated"] += 1

        participant_lookup = create_participants_for_event(db, event, event_rows, now)
        submissions = []
        for row in event_rows:
            member = upsert_member_from_row(db, row, now)
            participant = participant_lookup[(row["gender"], row["seatNo"])]
            participant["memberId"] = member["id"]

            submission = create_submission(event, participant, member, row)
            participant["latestSubmissionId"] = submission["id"]
            db["surveySubmissions"].append(submission)
            submissions.append(submission)

        run = create_run(db, event, participant_lookup, submissions, now)
        event["releasedCalculationRunId"] = run["id"]
        event["resultReleasedAt"] = run["releasedAt"]
        report["surveyRowsImported"] += len(submissions)
        report["submissionsCreated"] += len(submissions)

    profile_only_count = import_profile_rows(db, profile_rows, now)
    report["profileRowsSeen"] = count_profile_rows(profile_rows)
    report["profileRowsImported"] = profile_only_count

    if include_demo_event:
        add_empty_demo_event(db, now)

    report["membersCreated"] = len(db["members"])
    report["matchesCreated"] = len(db["matchResults"])
    report["voteStatsCreated"] = len(db["voteStats"])
    return db, report


def empty_db():
    return {
        "members": [],
        "events": [],
        "eventParticipants": [],
        "surveySubmissions": [],
        "calculationRuns": [],
        "matchResults": [],
        "voteStats": [],
        "contactViewLogs": [],
    }


def normalize_survey_rows(rows):
    if not rows:
        return []
    normalized = []
    for row in rows[1:]:
        if len(row) < 6 or not clean_text(row[0], keep_zero=True):
            continue
        gender, seat_no = parse_seat_label(get_cell(row, 5))
        if not gender or not seat_no:
            continue
        normalized.append({
            "submittedAt": iso_from_excel_text(get_cell(row, 0)),
            "eventDate": date_only(get_cell(row, 0)),
            "name": clean_text(get_cell(row, 2), keep_zero=True) or clean_text(get_cell(row, 4), keep_zero=True),
            "phone": normalize_phone(get_cell(row, 3)),
            "nickname": clean_text(get_cell(row, 4), keep_zero=True) or clean_text(get_cell(row, 2), keep_zero=True),
            "gender": gender,
            "seatNo": seat_no,
            "firstChoice": parse_seat_label(get_cell(row, 6)),
            "secondChoice": parse_seat_label(get_cell(row, 7)),
            "birthYear": clean_text(get_cell(row, 11)),
            "job": clean_text(get_cell(row, 12)),
            "height": clean_text(get_cell(row, 13)),
            "strengths": clean_text(get_cell(row, 14)),
            "mbti": clean_text(get_cell(row, 15)).upper(),
            "desiredPartner": clean_text(get_cell(row, 16)),
            "availableDays": clean_text(get_cell(row, 18), keep_zero=True),
            "letter": clean_text(get_cell(row, 19), keep_zero=True),
        })
    return normalized


def get_cell(row, index):
    return row[index] if len(row) > index else ""


def latest_rows_by_seat(rows):
    latest = {}
    for row in sorted(rows, key=lambda item: item["submittedAt"]):
        latest[(row["gender"], row["seatNo"])] = row
    return sorted(latest.values(), key=lambda item: (item["gender"], item["seatNo"]))


def create_event(db, event_date, rows, now):
    max_male = max_seat(rows, "male")
    max_female = max_seat(rows, "female")
    slug = f"momangde-{compact_date(event_date)}"
    event_id = f"EVT-{slug}"
    event = {
        "id": event_id,
        "title": f"모망드 부부 과거 매칭 ({compact_date(event_date)})",
        "eventDate": event_date,
        "location": "모망드 커피",
        "maleCapacity": max_male,
        "femaleCapacity": max_female,
        "voteOpensAt": None,
        "voteClosesAt": None,
        "voteClosedAt": f"{event_date}T23:00:00.000Z",
        "resultReleasedAt": None,
        "releasedCalculationRunId": None,
        "status": "released",
        "publicSlug": slug,
        "createdAt": f"{event_date}T00:00:00.000Z",
        "updatedAt": now,
    }
    db["events"].append(event)
    return event


def max_seat(rows, gender):
    values = [row["seatNo"] for row in rows if row["gender"] == gender]
    for row in rows:
        for choice in (row["firstChoice"], row["secondChoice"]):
            choice_gender, choice_seat = choice
            if choice_gender == gender and choice_seat:
                values.append(choice_seat)
    return max(values) if values else 1


def create_participants_for_event(db, event, rows, now):
    lookup = {}
    for gender, capacity in (("male", event["maleCapacity"]), ("female", event["femaleCapacity"])):
        gender_code = "M" if gender == "male" else "F"
        for index in range(1, capacity + 1):
            participant = {
                "id": f"EP-{event['id']}-{gender_code}{index}",
                "eventId": event["id"],
                "gender": gender,
                "seatNo": index,
                "memberId": None,
                "latestSubmissionId": None,
                "attendanceStatus": "present",
                "isActive": True,
                "createdAt": f"{event['eventDate']}T00:00:00.000Z",
                "updatedAt": now,
            }
            db["eventParticipants"].append(participant)
            lookup[(gender, index)] = participant
    return lookup


def upsert_member_from_row(db, row, now, update_latest=True):
    key = member_key(row)
    member = find_member_by_key(db, key, row)
    if not member:
        member = {
            "id": f"MEM-{len(db['members']) + 1}",
            "name": row["name"],
            "phone": row["phone"],
            "phoneLast4": row["phone"][-4:] if row["phone"] else "",
            "nickname": row["nickname"],
            "canonicalName": row["name"],
            "canonicalNickname": row["nickname"],
            "latestName": row["name"],
            "latestNickname": row["nickname"],
            "nameAliases": [],
            "nicknameAliases": [],
            "gender": row["gender"],
            "birthYear": "",
            "job": "",
            "height": "",
            "strengths": "",
            "mbti": "",
            "desiredPartner": "",
            "status": "normal",
            "memo": "",
            "firstJoinedAt": row["submittedAt"],
            "lastJoinedAt": row["submittedAt"],
            "createdAt": row["submittedAt"],
            "updatedAt": now,
        }
        db["members"].append(member)

    add_alias(member["nameAliases"], row["name"])
    add_alias(member["nicknameAliases"], row["nickname"])
    if update_latest:
        member["latestName"] = row["name"] or member["latestName"]
        member["latestNickname"] = row["nickname"] or member["latestNickname"]
        member["lastJoinedAt"] = max(member.get("lastJoinedAt") or row["submittedAt"], row["submittedAt"])
    member["gender"] = row["gender"] or member["gender"]
    apply_profile(member, row)
    member["updatedAt"] = now
    return member


def member_key(row):
    if row.get("phone"):
        return ("phone", row["phone"])
    return ("fallback", row.get("gender"), row.get("seatNo"), row.get("nickname") or row.get("name"))


def find_member_by_key(db, key, row):
    if key[0] == "phone":
        return next((member for member in db["members"] if member.get("phone") == key[1]), None)
    normalized_nickname = normalize_name(row.get("nickname") or row.get("name"))
    return next(
        (
            member
            for member in db["members"]
            if not member.get("phone")
            and member.get("gender") == row.get("gender")
            and normalized_nickname in [normalize_name(member.get("nickname")), normalize_name(member.get("name"))]
        ),
        None,
    )


def add_alias(aliases, value):
    text = clean_text(value, keep_zero=True)
    if text and normalize_name(text) not in [normalize_name(item) for item in aliases]:
        aliases.append(text)


def normalize_name(value):
    return re.sub(r"\s+", "", str(value or "").strip().lower())


def apply_profile(member, row):
    for field in ("birthYear", "job", "height", "strengths", "mbti", "desiredPartner"):
        value = clean_text(row.get(field, ""))
        if value:
            member[field] = value


def create_submission(event, participant, member, row):
    submission_id = f"SUB-{event['id']}-{participant['gender']}-{participant['seatNo']}-v1"
    first_choice_id = choice_to_participant_id(event, row["firstChoice"])
    second_choice_id = choice_to_participant_id(event, row["secondChoice"])
    return {
        "id": submission_id,
        "eventId": event["id"],
        "eventParticipantId": participant["id"],
        "memberId": member["id"],
        "version": 1,
        "submittedAt": row["submittedAt"],
        "name": row["name"],
        "phone": row["phone"],
        "phoneLast4": row["phone"][-4:] if row["phone"] else "",
        "nickname": row["nickname"],
        "gender": row["gender"],
        "seatNo": participant["seatNo"],
        "firstChoiceId": first_choice_id,
        "secondChoiceId": second_choice_id,
        "reviewNote": row["letter"],
        "comment": f"가능 요일: {row['availableDays']}" if row["availableDays"] else "",
        "isLatest": True,
        "createdAt": row["submittedAt"],
    }


def choice_to_participant_id(event, choice):
    gender, seat_no = choice
    if not gender or not seat_no:
        return "none"
    gender_code = "M" if gender == "male" else "F"
    return f"EP-{event['id']}-{gender_code}{seat_no}"


def create_run(db, event, participant_lookup, submissions, now):
    run = {
        "id": f"RUN-{event['id']}-1",
        "eventId": event["id"],
        "runNo": 1,
        "status": "released",
        "createdAt": f"{event['eventDate']}T23:00:00.000Z",
        "releasedAt": f"{event['eventDate']}T23:05:00.000Z",
        "warnings": [],
        "calculationSummary": calculation_summary(event, participant_lookup, submissions),
    }
    db["calculationRuns"].append(run)

    matches = build_matches(submissions)
    for index, match in enumerate(matches, start=1):
        db["matchResults"].append({
            "id": f"MR-{run['id']}-{index}",
            "eventId": event["id"],
            "calculationRunId": run["id"],
            "status": "released",
            **match,
            "createdAt": run["createdAt"],
        })

    stats = build_vote_stats(event, submissions)
    participants_by_id = {participant["id"]: participant for participant in participant_lookup.values()}
    submissions_by_participant = {submission["eventParticipantId"]: submission for submission in submissions}
    for stat in stats:
        participant = participants_by_id[stat["participantId"]]
        submission = submissions_by_participant.get(stat["participantId"], {})
        db["voteStats"].append({
            "id": f"VS-{run['id']}-{stat['participantId']}",
            "eventId": event["id"],
            "calculationRunId": run["id"],
            "participantId": stat["participantId"],
            "gender": participant["gender"],
            "seatNo": participant["seatNo"],
            "name": submission.get("name", ""),
            "nickname": submission.get("nickname", ""),
            "receivedFirstCount": stat["receivedFirstCount"],
            "receivedSecondCount": stat["receivedSecondCount"],
            "score": stat["score"],
            "genderRank": stat["genderRank"],
            "createdAt": run["createdAt"],
        })
    return run


def calculation_summary(event, participant_lookup, submissions):
    submitted = Counter(submission["gender"] for submission in submissions)
    return {
        "configuredMaleCount": event["maleCapacity"],
        "configuredFemaleCount": event["femaleCapacity"],
        "submittedMaleCount": submitted["male"],
        "submittedFemaleCount": submitted["female"],
        "includedMaleCount": submitted["male"],
        "includedFemaleCount": submitted["female"],
        "excludedAbsentCount": 0,
        "flaggedBlacklistCount": 0,
        "unsubmittedCount": len(participant_lookup) - len(submissions),
    }


def build_matches(submissions):
    submissions_by_participant = {submission["eventParticipantId"]: submission for submission in submissions}
    submitted_ids = set(submissions_by_participant)
    matches = []
    for male in [submission for submission in submissions if submission["gender"] == "male"]:
        for male_choice in choice_list(male):
            if male_choice["targetParticipantId"] not in submitted_ids:
                continue
            female = submissions_by_participant[male_choice["targetParticipantId"]]
            if female["gender"] != "female":
                continue
            for female_choice in choice_list(female):
                if female_choice["targetParticipantId"] == male["eventParticipantId"]:
                    matches.append({
                        "maleParticipantId": male["eventParticipantId"],
                        "femaleParticipantId": female["eventParticipantId"],
                        "maleChoiceRank": male_choice["rank"],
                        "femaleChoiceRank": female_choice["rank"],
                        "matchCode": f"M{male_choice['rank']}-F{female_choice['rank']}",
                    })
    return matches


def choice_list(submission):
    choices = []
    if submission.get("firstChoiceId") and submission["firstChoiceId"] != "none":
        choices.append({"rank": 1, "targetParticipantId": submission["firstChoiceId"]})
    if submission.get("secondChoiceId") and submission["secondChoiceId"] != "none":
        choices.append({"rank": 2, "targetParticipantId": submission["secondChoiceId"]})
    return choices


def build_vote_stats(event, submissions):
    participants = {
        submission["eventParticipantId"]: {
            "participantId": submission["eventParticipantId"],
            "gender": submission["gender"],
            "receivedFirstCount": 0,
            "receivedSecondCount": 0,
            "score": 0,
            "genderRank": None,
        }
        for submission in submissions
    }
    for submission in submissions:
        for choice in choice_list(submission):
            target = participants.get(choice["targetParticipantId"])
            if not target:
                continue
            if choice["rank"] == 1:
                target["receivedFirstCount"] += 1
                target["score"] += 2
            if choice["rank"] == 2:
                target["receivedSecondCount"] += 1
                target["score"] += 1

    stats = list(participants.values())
    for gender in ("male", "female"):
        gender_stats = [stat for stat in stats if stat["gender"] == gender]
        for stat in gender_stats:
            stat["genderRank"] = None if stat["score"] <= 0 else 1 + sum(
                1 for other in gender_stats if other["score"] > stat["score"]
            )
    return stats


def count_profile_rows(profile_rows):
    return sum(1 for row in profile_rows[1:] if any(clean_text(value, keep_zero=True) for value in row))


def import_profile_rows(db, profile_rows, now):
    if not profile_rows:
        return 0
    profile_only = 0
    for row in profile_rows[1:]:
        if not any(clean_text(value, keep_zero=True) for value in row):
            continue
        gender, seat_no = parse_seat_label(get_cell(row, 1))
        nickname = clean_text(get_cell(row, 0), keep_zero=True)
        phone = normalize_phone(get_cell(row, 2))
        pseudo = {
            "submittedAt": now,
            "name": nickname,
            "phone": phone,
            "nickname": nickname,
            "gender": gender or "",
            "seatNo": seat_no,
            "birthYear": clean_text(get_cell(row, 3)),
            "job": clean_text(get_cell(row, 4)),
            "height": clean_text(get_cell(row, 5)),
            "strengths": clean_text(get_cell(row, 6)),
            "mbti": clean_text(get_cell(row, 7)).upper(),
            "desiredPartner": clean_text(get_cell(row, 8)),
        }
        existed = bool(find_member_by_key(db, member_key(pseudo), pseudo))
        member = upsert_member_from_row(db, pseudo, now, update_latest=not existed)
        if not phone:
            member["memo"] = append_memo(member.get("memo", ""), "인적리스트 원본에 전화번호 없음")
        if not existed:
            profile_only += 1
    return profile_only


def append_memo(existing, addition):
    if not existing:
        return addition
    if addition in existing:
        return existing
    return f"{existing} / {addition}"


def add_empty_demo_event(db, now):
    if any(event["publicSlug"] == "demo" for event in db["events"]):
        return
    event = {
        "id": "EVT-demo",
        "title": "부부, 호기심에서 결혼까지",
        "eventDate": date_only(now),
        "location": "",
        "maleCapacity": 5,
        "femaleCapacity": 5,
        "voteOpensAt": None,
        "voteClosesAt": None,
        "voteClosedAt": None,
        "resultReleasedAt": None,
        "releasedCalculationRunId": None,
        "status": "voting",
        "publicSlug": "demo",
        "createdAt": now,
        "updatedAt": now,
    }
    db["events"].insert(0, event)
    for gender, capacity in (("male", 5), ("female", 5)):
        gender_code = "M" if gender == "male" else "F"
        for seat_no in range(1, capacity + 1):
            db["eventParticipants"].insert(0, {
                "id": f"EP-EVT-demo-{gender_code}{seat_no}",
                "eventId": "EVT-demo",
                "gender": gender,
                "seatNo": seat_no,
                "memberId": None,
                "latestSubmissionId": None,
                "attendanceStatus": "present",
                "isActive": True,
                "createdAt": now,
                "updatedAt": now,
            })


def load_workbook_rows(source):
    sheets = read_xlsx(source)
    if len(sheets) < 2:
        raise ValueError("Expected at least two sheets: survey history and profile list")
    return sheets[0], sheets[1]


def write_import(db, report, db_path):
    db_path = Path(db_path)
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_path = None
    if db_path.exists():
        backup_dir = db_path.parent / "backups"
        backup_dir.mkdir(parents=True, exist_ok=True)
        backup_path = backup_dir / f"db.before-momangde-import-{timestamp}.json"
        shutil.copy2(db_path, backup_path)

    report_dir = db_path.parent / "import-reports"
    report_dir.mkdir(parents=True, exist_ok=True)
    report_path = report_dir / f"momangde-import-{timestamp}.json"
    report["backupPath"] = str(backup_path) if backup_path else None
    report["reportPath"] = str(report_path)

    tmp_path = db_path.with_suffix(db_path.suffix + ".tmp")
    db_path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path.write_text(json.dumps(db, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    tmp_path.replace(db_path)
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return report


def main(argv=None):
    parser = argparse.ArgumentParser(description="Import Momangde/Buboo Excel history into Buboo JSON DB")
    parser.add_argument("--source", required=True, help="Path to xlsx file")
    parser.add_argument("--db", default="data/db.json", help="Path to destination db.json")
    parser.add_argument("--no-demo", action="store_true", help="Do not add an empty demo event")
    parser.add_argument("--dry-run", action="store_true", help="Parse and summarize without writing")
    args = parser.parse_args(argv)

    (_, survey_rows), (_, profile_rows) = load_workbook_rows(args.source)
    db, report = build_db_from_rows(survey_rows, profile_rows, include_demo_event=not args.no_demo)
    if not args.dry_run:
        report = write_import(db, report, args.db)

    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
