import os
import sys
import pandas as pd

###############################################################################
# 편집할 구간: 채점에 사용할 함수 정의
# 정확도 계산에 사용할 함수로 sklearn의 accuracy_score를 불러옵니다.
from sklearn.metrics import accuracy_score 
##############################################################################​

# 해당 파일이 전달받는 인자들의 목록입니다. 
# sys.argv[1]: 자동으로 매겨지는 부분으로 그대로 놔두시면 됩니다.
# sys.argv[2]: 자동으로 매겨지는 부분으로 그대로 놔두시면 됩니다.
# sys.argv[3]: 제출된 결과 파일의 경로를 받는 인자입니다. 점수를 계산하는 함수에서 y_pred 자리에 들어갈 값입니다.
gt = pd.read_csv(sys.argv[1], header=None)
pr = pd.read_csv(sys.argv[2], header=None)​

##############################################################################
# 편집할 구간: 정답 및 제출 파일 형식에 맞는 불러오기 코드  
# 값 불러오기
gt = gt.to_numpy().astype(int).reshape(-1)
pr = pr.to_numpy().astype(int).reshape(-1)
# predict_data = pd.read_csv(sys.argv[3]).to_numpy()[:,1:].astype(int).reshape(-1, 1)  # 참가자가 제출한 결과 파일을 .csv 테이블 형태로 불러옵니다.
# label_data = pd.read_csv("./answer.csv").to_numpy()[:,1:].astype(int).reshape(-1, 1)   # 정답파일을 .csv 테이블 형태로 불러옵니다. 
                                                                                                # 정답 파일 위치는 직접 입력하지 말고 비워두시면 됩니다.​
#print(gt)
#print(pr)

# 스코어 산출
score = accuracy_score(gt, pr)  # 위에서 가져온 함수에 불러온 정답 테이블 및 결과 테이블을 입력하여 스코어를 계산합니다.
print("score:", score)