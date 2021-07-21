import os
import sys
import psycopg2 as pg2
from subprocess import run, PIPE
​# sys.path.append("/root/mf/aifactory/.local/lib/python3.6/site-packages")
​# 인자 설정: Popen(['python', code_test, answer, file_moved, code])를 받아옴
answer = sys.argv[1]
upfile = sys.argv[2]
code = sys.argv[3]
task_key = sys.argv[1].split('/')[-2]
​# 채점코드 실행
if os.path.splitext(code)[-1].lower() == '.r':  # R로 제출된 경우
    p = run(['Rscript', code, answer, upfile], stdout=PIPE, stderr=PIPE)
else:
    p = run(['python3', code, answer, upfile], stdout=PIPE, stderr=PIPE)  # windows에서는 shell=True로 작동했음
p_out_test = p.stdout.decode('UTF-8')
p_err_test = p.stderr.decode('UTF-8')
​
# 결과 업데이트
err_message = None
# iitp - 조건에 따라 DB 주소 변경
task_loc = os.path.split(os.path.split(code)[0])[-1]
​
conn = pg2.connect(host=f'{os.getenv("DB_HOST")}', port='5432', user=f'{os.getenv("DB_USER")}',
                   password=f'{os.getenv("DB_PASSWORD")}', database=f'{os.getenv("DB_NAME")}')  # 연결
​
curs = conn.cursor()  # cursor 객체 가져오기
​
if (p.returncode > 0) or ('error' in p_out_test.lower()):  # 오류가 있는 경우
    err_message = p_err_test  # p_err_test를 에러메세지로
elif p.returncode == 0:  # 오류가 없는 경우
    try:  # public만 있는 경우와 private까지 있는 경우 모두 고려
        score_line = [line for line in p_out_test.split('\n') if 'score:' in line]  # 'score:'가 있는 부분만 가져오기
        pb_score = round(float(score_line[0].replace('\n', '').replace('score:', '').replace(' ', '')), 10)
        if len(score_line) > 1:
            pr_score = round(float(score_line[1].replace('\n', '').replace('score:', '').replace(' ', '')), 10)
    except:  # 오류가 없는데 'score:' 출력이 없는 경우
        err_message = "Error: 스코어가 정상 출력되지 않았습니다. print()문을 이용하여 score: 0000의 형태로 정상 출력하도록 하였는지, 또는 nan 값을 출력하고 있는지 확인바랍니다."
    else:  # score를 정상 확보한 경우
        sql = "UPDATE T_CALCULATE_SET LA SET VERIFY_STATUS = %s, VERIFY_ERR_MSG = %s WHERE TASK_ID = %s;"
        # sql = "UPDATE T_CALCULATE_SET LA SET VERIFY_STATUS=" + "success" + ", VERIFY_ERR_MSG=" + str(pb_score) + ", WHERE TASK_ID=" + str(task_key)  # 정상 결과 업데이트
        curs.execute(sql, ("success", str(pb_score), str(task_key)))  # DB 업데이트
        conn.commit()  # DB 저장
​
if err_message != None:  # 오류가 있는 경우 에러메세지 업데이트
    err_message = err_message.replace("/aifactory/src", "{workdir}")
    sql = "UPDATE T_CALCULATE_SET LA SET VERIFY_STATUS = %s, VERIFY_ERR_MSG = %s WHERE TASK_ID = %s;"
    curs.execute(sql, ("fail", err_message, str(task_key)))  # DB 업데이트
    conn.commit()  # DB 저장
​
conn.close()  # conn 종료
os.remove(upfile)  # 테스트용 파일 삭제