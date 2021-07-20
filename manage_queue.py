import os
import time
import glob
import shutil
from subprocess import Popen

# parameters -----------------------------------------------------------------#
max_processes = 6
source_loc = "/root/mf/aifactory/QUEUE" 
target_loc = "/root/mf/aifactory/RUNNING"
task_src = "/root/mf/aifactory/src"
wrapper = "/root/mf/aifactory/wrapper.py"
nipa_wrapper = "/root/mf/aifactory/nipa_wrapper.py"
code_test = "/root/mf/aifactory/code_test.py"
#-----------------------------------------------------------------------------#

# queue 업데이트 -------------------------------------------------------------#
queue = []
while True:
    time.sleep(5) # 약간의 딜레이
    # 파일명 앞에 yymmdd가 붙기 때문에 glob.iglob으로 읽어들이면 입력순서는 자동으로 정렬됨 
    new_files = [file for file in glob.iglob(f'{source_loc}/*.*') if file not in queue]
    if len(new_files) > 0:
        queue.extend(new_files)
#-----------------------------------------------------------------------------#

#-----------------------------------------------------------------------------#
    # queue의 길이가 1 이상이면
    if len(queue) > 0:
        # 처리중인 파일 개수 읽고
        count = len(glob.glob(f'{target_loc}/*.*'))
        # count가 허용치보다 작으면:
        if count < max_processes:
            file = queue[0]
            fname = os.path.split(file)[1]
            print(fname)
            try:
                uptime, pb_key, pr_key, task, code, answer, suffix = fname.split('-')
            except Exception as e:
                shutil.move(file, f'{source_loc}/Error/{fname}')
                print(e, f': {fname}')
            else:
                # 파일 먼저 옮기고
                file_moved = os.path.join(target_loc, f'{uptime}_{suffix}') # 제출 파일 현재 경로
                shutil.move(file, file_moved)

                # 경로 생성
                task_loc = f"{task_src}/{task}"  # 태스크 폴더
                code = f"{task_loc}/{code}" # 채점 파일 경로
                answer = f"{task_loc}/{answer}"# 정답 경로

                # 채점
                if pb_key == "code_test":  # subprocess로 채점코드 테스트용 wrapper 수행
                    Popen(['python3', code_test, answer, file_moved, code])
                elif "M" in task:
                    print("RUN NIPA wrapper")
                    Popen(['python3', nipa_wrapper, answer, file_moved, code, pb_key])
                else:  # subprocess로 채점용 wrapper 수행
                    Popen(['python3', wrapper, answer, file_moved, code, pb_key, pr_key]) 

            # queue에서 target을 제거
            queue = queue[1:]
