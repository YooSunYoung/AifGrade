# 메인 채점 루트에서는 DB key, 채점 파일 경로, 제출 파일 경로와 같은 중요한 인자들을 
# 핵심만 분해한 뒤 결과 파일 이름에 집어넣어서 대기열 폴더로 전송합니다.
# 대기열을 관리하는 manage_queue.py는 대기열에 들어온 파일 이름으로부터 인자를 추출하여
# subprocess를 통해 wrapper.py로 넘깁니다. 
# wrapper.py는 인자들을 이용하여 채점하고 결과를 DB에 전송합니다.
# 모든 태스크의 정답 파일명은 확장자 포함 "answer.xxx"로 통일합니다. 
# 확장자가 없는 경우는 그냥 "answer"가 됩니다.
# 모든 태스크의 채점코드 파일명은 확장자 포함 "calculate.xxx"로 통일합니다.
# 

import os
import flask
import random
import string
import shutil
import glob
import requests
from flask_cors import CORS
from datetime import datetime
import psycopg2 as pg2
import pandas as pd
from werkzeug.datastructures import FileStorage

# 파라미터
UPLOAD_DIR = "/root/mf/aifactory/SUBMISSION"
QUEUE_DIR = "/root/mf/aifactory/QUEUE"
TEMP_DIR = "/root/mf/aifactory/TEMP"
MODEL_DIR = "/root/mf/aifactory/SAVE/nipa"
app = flask.Flask(__name__)
app.config['UPLOAD_DIR'] = UPLOAD_DIR  # 결과 업로드
app.config['QUEUE_DIR'] = QUEUE_DIR  # 큐 폴더
app.config['TEMP_DIR'] = TEMP_DIR  # 큐 폴더
app.config['MODEL_DIR'] = MODEL_DIR # 모델 업로드 폴
CORS(app)


# 플라스크 서버 메인 채점루트
@app.route("/aifactory", methods=["POST"])
def calculate():
    src_root = "/root/mf/aifactory/src"
    if flask.request.method == "POST":
        argv1 = flask.request.values["argv2"]  # public score DB primary_key 
        argv2 = flask.request.values["argv4"]  # private score DB primary_key 
        argv3 = os.path.split(flask.request.values["argv1"])[0].split('/')[-1]  # 태스크 경로명 ('/T000001/abcd.py'를 분해)
        argv4 = os.path.split(flask.request.values["argv1"])[1]  # 채점코드 파일명
        argv5 = os.path.split(sorted(glob.glob(f"{src_root}/{argv3}/answer*"), key=os.path.getmtime)[-1])[-1] # 정답파일명 (가장 최근에 올라온 answer*)
        print(argv1,argv2,argv3,argv4,argv5)
       
        file = flask.request.files["file"]
        filename = flask.request.files["file"].filename
        time = datetime.now().strftime('%Y%m%d%H%M%S%f')
        pool = list(string.ascii_uppercase) + list(string.ascii_lowercase) + [str(i) for i in range(10)] # 랜덤 suffix 생성 pool
        suffix = ''.join(random.choices(pool, k=4)) # suffix 생성
        ext = os.path.splitext(filename)[-1]  # 확장자 추출
        filename = f"{time}_{suffix}{ext}"
        new_filename = f"{time}-{argv1}-{argv2}-{argv3}-{argv4}-{argv5}-{suffix}{ext}"
        file.save(f"{app.config['UPLOAD_DIR']}/{filename}")  #인자를 파일명에 붙여서 Queue 관리 프로세스로 전달
        print("filesize:")
        print(os.path.getsize(f"{app.config['UPLOAD_DIR']}/{filename}"))
        shutil.move(f"{app.config['UPLOAD_DIR']}/{filename}", f"{app.config['QUEUE_DIR']}/{new_filename}")
        result = {"result":"success"}
        return flask.jsonify(result)  # WAS로 반환하는 값으로 바꾸지 말 것
    return "false"  # WAS로 반환하는 값으로 바꾸지 말 것


# 라이브러리 제출용
@app.route("/submit", methods=["POST"])
def nipatest_calculate():
    # conditions
    src_root = "/root/mf/aifactory/src" 
    
    # # ID와 ID별 신청된 태스크번호, 할당된 IP를 한 테이블로 만들어서 검증용으로 사용
    # info_table = pd.read_csv("C:/Users/Pathfinder/Desktop/info_table.csv")
    
    if flask.request.method == "POST":
        # DB 접속
        conn = pg2.connect(host='aifactory.cp90w5j6b2ld.ap-northeast-2.rds.amazonaws.com', port='5432', user='aifactory', password='aifactory!23', database='aifactorydb')  # 연결
        curs = conn.cursor()

        # user_id 확보/ID 검증
        user_sql = "SELECT USER_ID FROM T_USER WHERE USER_EMAIL = '" + f"{flask.request.values['user_id']}'"
        curs.execute(user_sql)
        try:
            user_id = curs.fetchone()[0]
        except:
            conn.close()  # conn 종료
            return "존재하지 않는 사용자입니다. 등록하신 e-mail 주소를 확인하시기 바랍니다."

        # 태스크 번호 및 기타 정보        
        task_no = flask.request.values["task_no"]
        filename = flask.request.values['file_name']
        model_nm = flask.request.values['model_name']
        # ip_address = flask.request.remote_addr # 클라이언트 IP 주소 받기

        # 태스크 검증
        tasks = os.listdir(src_root)
        if task_no not in tasks:
            conn.close()  # conn 종료
            return "존재하지 않는 태스크입니다. 태스크 번호를 확인하시기 바랍니다."
        
        # 파일 수신 및 DB 업로드 재료
        time = datetime.now().strftime('%Y%m%d%H%M%S%f')
        pool = list(string.ascii_uppercase) + list(string.ascii_lowercase) + [str(i) for i in range(10)] # 랜덤 suffix 생성 pool
        suffix = ''.join(random.choices(pool, k=4)) # suffix 생성
        ext = os.path.splitext(filename)[-1]  # 확장자 추출
        filename = f"{time}_{suffix}{ext}"
        
        # DB에 값을 입력할 자리와 key값을 미리 생성 (WEB 기능 대체) - public private 2회 해야 함
        for code in ['0000', '0001']:
            curs.execute("SELECT CAST(COALESCE(MAX(ADHRNC_SN), '0') AS INTEGER) + 1 FROM T_LAP_ADHRNC")
            adhrnc_sn = curs.fetchone()[0]
            sql_create = "INSERT INTO T_LAP_ADHRNC" \
            " (ADHRNC_SN, TASK_ID, LAP_SN," \
                " ADHRNC_SE_CODE, TEAM_SN, USER_ID," \
                    " MODEL_NM, SCRE, RESULT_SBMISN_MTHD_CODE," \
                        " ATCH_FILE_ID, REGISTER_ID, REGIST_DTTM)"\
                            " VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP);"
            curs.execute(sql_create, (adhrnc_sn, task_no, 1, code, None, user_id, model_nm, None, code, None, user_id))
            conn.commit()  # DB 저장

        # 전달할 인자        
        argv3 = task_no
        argv4 = 'calculate.py'
        argv5 = os.path.split(sorted(glob.glob(f"{src_root}/{argv3}/answer*"), key=os.path.getmtime)[-1])[-1] # 정답파일명 (가장 최근에 올라온 answer*)

        # 파일 수신        
        path = os.path.join(f"{app.config['UPLOAD_DIR']}", filename)
        FileStorage(flask.request.files.get('file')).save(path)
        conn.close()  # conn 종료

        new_filename = f"{time}-{adhrnc_sn-1}-{adhrnc_sn}-{argv3}-{argv4}-{argv5}-{suffix}{ext}"
        shutil.move(f"{app.config['UPLOAD_DIR']}/{filename}", f"{app.config['QUEUE_DIR']}/{new_filename}") # 안정성을 위해 큐는 별도 폴더로
        print('Queue save')

        return filename  # WAS로 반환하는 값으로 바꾸지 말 것
    return "false"  # WAS로 반환하는 값으로 바꾸지 말 것


# 플라스크 서버 채점스크립트 검증용 루트
## 채점스크립트 검증용 DB 테이블은 태스크ID로 구분하므로 pkey 불필요. -> pkey용 argv1, 2를 다른용도로 사용 가능 ("code_test"값으로 지정)
@app.route('/createcalculator', methods=['POST'])
def createCalculate():
    src_root = "/root/mf/aifactory/src"
    if flask.request.method == "POST":
        # 파일 저장 구간
        dirname = flask.request.values["dirname"]  # 폴더명이자 태스크명
        code_filename = flask.request.values["calculateFilename"]  # 채점코드 파일명 지정
        answer_filename = flask.request.values["answerFilename"]  # 정답파일 파일명 지정
        code_ext = code_filename.split('.')[-1]  # 확장자 추출
        answer_ext = os.path.splitext(answer_filename)[-1]  # 확장자 추출        
        new_code_name = f"calculate.{code_ext}"
        new_answer_name = f"answer{answer_ext}"
        os.rename(f'{src_root}/{dirname}/{code_filename}', f'{src_root}/{dirname}/{new_code_name}')
        os.rename(f'{src_root}/{dirname}/{answer_filename}', f'{src_root}/{dirname}/{new_answer_name}')        

        # # 기존의 큐 경로에 넣어 테스트 채점 시키기
        time = datetime.now().strftime('%Y%m%d%H%M%S%f')  # 큐에서 시간정렬이 되도록 현재 시간값 가져오기
        temp_test_name = f"{time}-code_test-0001-{dirname}-{new_code_name}-{new_answer_name}-{new_answer_name}"  # dirname, code_filename, answer_filename 전체경로 아님
        shutil.copy(f"{src_root}/{dirname}/{new_answer_name}", f"{app.config['TEMP_DIR']}/{temp_test_name}")  # TEMP로 카피 후
        shutil.move(f"{app.config['TEMP_DIR']}/{temp_test_name}", f"{app.config['QUEUE_DIR']}/{temp_test_name}")  # QUEUE로 이동. QUEUE로 바로 copy
        
        return "success"
    return "not post"


# 파일 업로드 루트
@app.route('/uploadfile', methods=['POST'])
def upload():
    src_root = "/root/mf/aifactory/src"
    if flask.request.method == "POST":
        dirname = flask.request.values["taskid"] #python3

        if(not os.path.isdir(f"{src_root}/{dirname}")):
            os.makedirs(f"{src_root}/{dirname}")
        uploadfile = flask.request.files["files"]
        filename = uploadfile.filename
        filepath = f"{src_root}/{dirname}/{filename}"
        uploadfile.save(filepath)
        fileSize = os.path.getsize(filepath)
        fileExt = os.path.splitext(filename)[1]

        result = {"upload":[{"fileSize": fileSize,"streFileNm": filename,"fileStreCours": filename,"orignlFileNm": filename,"fileExtsn": fileExt}]}
        return flask.jsonify(result)
    return "error"


# 실행에서 메인 쓰레드인 경우 서버를 시작.
if __name__ == "__main__":
    print(("* Starting Flask server..."
        "please wait until the server has fully started."))
    app.run(host='0.0.0.0', port='8889', threaded=True)
