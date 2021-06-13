import os
import sys
import shutil
import numpy as np
import psycopg2 as pg2
from subprocess import run, PIPE
sys.path.append("/root/mf/aifactory/.local/lib/python3.6/site-packages")
os.chdir("/root/mf/aifactory/TEMP")

# 인자 설정: Popen(['python', wrapper, answer, file_moved, code, pb_key, pr_key])를 받아옴
answer = sys.argv[1]
upfile = sys.argv[2]
code = sys.argv[3]
pb_key = sys.argv[4]
pr_key = sys.argv[5]
save_loc = "/root/mf/aifactory/SAVE"
fail_loc = "/root/mf/aifactory/FAILED"

# 채점코드 실행
if os.path.splitext(code)[-1].lower() == '.r':  # R로 제출된 경우
    p = run(['Rscript', code, answer, upfile], stdout=PIPE, stderr=PIPE)
else:
    p = run(['python3', code, answer, upfile], stdout=PIPE, stderr=PIPE)  # windows에서는 shell=True로 작동했음
p_out_test = p.stdout.decode('UTF-8')
p_err_test = p.stderr.decode('UTF-8')

err_message = None  # 에러메세지 초기화

# iitp - 조건에 따라 DB 주소 변경
task_loc = os.path.split(os.path.split(code)[0])[-1]
#  고려사이버대    
if task_loc[0] == 'C':
    conn = pg2.connect(host='aifactory.cp90w5j6b2ld.ap-northeast-2.rds.amazonaws.com', port='5432', user='cuk', password='cuk!23', database='cuk')  # 연결    
# 나머지 전체    
else:    
    conn = pg2.connect(host='aifactory.cp90w5j6b2ld.ap-northeast-2.rds.amazonaws.com', port='5432', user='aifactory', password='aifactory!23', database='aifactorydb')  # 연결
curs = conn.cursor()  # cursor 객체 가져오기

if (p.returncode > 0) or ('error' in p_out_test.lower()):  # 오류가 있는 경우
    err_message = p_err_test  # p_err_test를 에러메세지로
    if 'error' in p_out_test.lower():
        err_message = p_out_test
else:  # 오류가 없는 경우
    try:  # public만 있는 경우와 private까지 있는 경우 모두 고려
        score_line = [line for line in p_out_test.split('\n') if 'score:' in line]  # 'score:'가 있는 부분만 가져오기
        pb_score = round(float(score_line[0].replace('\n', '').replace('score:', '').replace(' ', '')), 10)
        if np.isnan(pb_score):
            pb_score = None
            err_message = 'Error: nan returned as score'
        if len(score_line) > 1:
            pr_score = round(float(score_line[1].replace('\n', '').replace('score:', '').replace(' ', '')), 10)
            if np.isnan(pr_score):
                pr_score = None
                err_message = 'Error: nan returned as score'            
    except:  # 오류가 없는데 'score:' 출력이 없는 경우
        err_message = "Error: 스코어가 정상 출력되지 않았습니다. print()문을 이용하여 score: 0000의 형태로 정상 출력하도록 하였는지, 또는 nan 값을 출력하고 있는지 확인바랍니다."
        # err_message = "모의제출기간에는 스코어가 제공되지 않습니다."
    else:  # score를 정상 확보한 경우
        sql = "UPDATE T_LAP_ADHRNC LA SET SCRE = %s, FILE_NM = %s, ERR_MESSAGE = %s WHERE ADHRNC_SN = %s;"
        curs.execute(sql, (str(pb_score), os.path.split(upfile)[-1], None, str(pb_key)))   # DB 업데이트
        conn.commit()  # DB 저장
        if len(score_line) > 1:  # private score가 있는 경우
            sql = "UPDATE T_LAP_ADHRNC LA SET SCRE = %s, FILE_NM = %s, ERR_MESSAGE = %s WHERE ADHRNC_SN = %s;"
            curs.execute(sql, (str(pr_score), os.path.split(upfile)[-1], None, str(pr_key)))   # DB 업데이트
            conn.commit()  # DB 저장
        shutil.move(upfile, os.path.join(save_loc, os.path.split(upfile)[-1])) # 정상 채점 끝난 파일 save_loc에 저장
        
if err_message != None:  # 오류가 있는 경우 에러메세지 업데이트
    shutil.move(upfile, os.path.join(fail_loc, os.path.split(upfile)[-1])) # 오류 발생 파일 fail_loc에 저장    
    err_message = err_message.replace("/root/mf/aifactory/src", "{workdir}").replace("/root/mf/aifactory/TEMP", "{extract}")
    sql = "UPDATE T_LAP_ADHRNC LA SET SCRE = %s, ERR_MESSAGE = %s, FILE_NM = %s WHERE ADHRNC_SN = %s;"  # public score 부분에 에러메세지 업데이트
    curs.execute(sql, (None, err_message, os.path.split(upfile)[-1], str(pb_key)))   # DB 업데이트
    conn.commit()  # DB 저장
conn.close()  # conn 종료